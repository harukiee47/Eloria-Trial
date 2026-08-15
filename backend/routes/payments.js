import express from "express";
import crypto from "crypto";
import { verifyUser } from "../middleware/auth.js";
import { createCheckout } from "../services/lemonsqueezy.js";
import { db } from "../config/firebaseAdmin.js";
import { sendCancellationFeedbackEmail, sendWelcomeEmail, sendRenewalEmail } from "../services/emailService.js";

const router = express.Router();

router.post("/checkout", express.json(), verifyUser, async (req, res) => {
  try {
    const { plan } = req.body;
    const variantMap = {
      pro_monthly: process.env.LEMONSQUEEZY_VARIANT_PRO_MONTHLY,
      pro_yearly: process.env.LEMONSQUEEZY_VARIANT_PRO_YEARLY,
    };
    const variantId = variantMap[plan];
    if (!variantId) return res.status(400).json({ error: "Invalid or unconfigured plan." });

    const checkoutUrl = await createCheckout({
      variantId,
      uid: req.user.uid,
      email: req.user.email,
    });
    return res.json({ url: checkoutUrl });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to create checkout session." });
  }
});

router.post("/cancel", express.json(), verifyUser, async (req, res) => {
  try {
    const { reasons, otherText } = req.body || {};
    const userRef = db.collection("users").doc(req.user.uid);
    const userDoc = await userRef.get();
    const userData = userDoc.data() || {};
    const sub = userData.subscription;
    const subId = sub?.id;

    if (userData.plan !== "pro" && userData.plan !== "admin") {
      return res.status(400).json({ error: "You don't have an active Pro subscription." });
    }
    if (!subId) {
      return res.status(400).json({ error: "No subscription ID on file for your account. Contact support." });
    }
    if (sub?.cancelled) {
      return res.status(400).json({ error: "Auto-renew is already turned off." });
    }

    const response = await fetch(`https://api.lemonsqueezy.com/v1/subscriptions/${subId}`, {
      method: "PATCH",
      headers: {
        Accept: "application/vnd.api+json",
        "Content-Type": "application/vnd.api+json",
        Authorization: `Bearer ${process.env.LEMONSQUEEZY_API_KEY}`,
      },
      body: JSON.stringify({
        data: { type: "subscriptions", id: subId, attributes: { cancelled: true } },
      }),
    });

    if (!response.ok) {
      const bodyText = await response.text();
      console.error("Lemon Squeezy cancel failed:", response.status, bodyText);

      // Surface a useful, non-sensitive reason to the frontend instead of a generic 500.
      let reason = `Lemon Squeezy rejected the cancel request (status ${response.status}).`;
      if (response.status === 404) {
        reason = "This subscription ID doesn't exist in Lemon Squeezy (likely test/placeholder data, not a real subscription).";
      } else if (response.status === 401 || response.status === 403) {
        reason = "The server isn't authorized to talk to Lemon Squeezy — check LEMONSQUEEZY_API_KEY.";
      }
      return res.status(502).json({ error: reason });
    }

    await userRef.set(
      { subscription: { ...sub, cancelled: true } },
      { merge: true }
    );

    // Fire-and-forget — don't let an email hiccup block the cancel response.
    sendCancellationFeedbackEmail({
      userEmail: req.user.email,
      uid: req.user.uid,
      reasons: Array.isArray(reasons) ? reasons : [],
      otherText: typeof otherText === "string" ? otherText.slice(0, 1000) : "",
    }).catch(err => console.error("Cancellation feedback email failed:", err));

    return res.json({ success: true });
  } catch (err) {
    console.error("Cancel subscription error:", err);
    return res.status(500).json({ error: "Something went wrong on our end. Please try again." });
  }
});

router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    try {
      const signature = req.headers["x-signature"];
      const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
      if (!signature || !secret) return res.status(401).json({ error: "Missing signature." });

      const hmac = crypto.createHmac("sha256", secret);
      const digest = hmac.update(req.body).digest("hex");
      const isValid = crypto.timingSafeEqual(Buffer.from(digest, "utf8"), Buffer.from(signature, "utf8"));
      if (!isValid) return res.status(401).json({ error: "Invalid signature." });

      const payload = JSON.parse(req.body.toString("utf8"));
      const eventName = payload.meta?.event_name;
      const customData = payload.meta?.custom_data;
      const uid = customData?.uid;

      if (!uid) {
        console.warn("Webhook received without uid in custom_data:", eventName);
        return res.status(200).json({ received: true });
      }

      const ref = db.collection("users").doc(uid);

      // A subscription's `status` flips to "cancelled" the moment auto-renew is
      // turned off — but the user should keep Pro access until `ends_at`. Only
      // "expired" (or an ends_at that has actually passed) means downgrade now.
      const resolvePlan = (status, endsAt) => {
        if (status === "expired") return "free";
        if (endsAt && new Date(endsAt) < new Date()) return "free";
        if (status === "active" || status === "on_trial" || status === "cancelled" || status === "past_due") return "pro";
        return "free";
      };

      switch (eventName) {
        case "subscription_created": {
          const status = payload.data?.attributes?.status;
          const endsAt = payload.data?.attributes?.ends_at || null;
          const isCancelled = payload.data?.attributes?.cancelled === true;
          const userEmail = payload.data?.attributes?.user_email || customData?.email || null;

          await ref.set(
            {
              plan: resolvePlan(status, endsAt),
              email: userEmail || undefined,
              subscription: {
                id: payload.data?.id,
                status,
                cancelled: isCancelled,
                renewsAt: payload.data?.attributes?.renews_at || null,
                endsAt,
                reminderSent: false,
              },
            },
            { merge: true }
          );

          if (userEmail) {
            sendWelcomeEmail(userEmail).catch(err => console.error("Welcome email failed:", err));
          }
          break;
        }
        case "subscription_updated": {
          const status = payload.data?.attributes?.status;
          const endsAt = payload.data?.attributes?.ends_at || null;
          const isCancelled = payload.data?.attributes?.cancelled === true;

          await ref.set(
            {
              plan: resolvePlan(status, endsAt),
              subscription: {
                id: payload.data?.id,
                status,
                cancelled: isCancelled,
                renewsAt: payload.data?.attributes?.renews_at || null,
                endsAt,
                reminderSent: false,
              },
            },
            { merge: true }
          );
          break;
        }
        case "subscription_payment_success": {
          // Fired for every successful invoice, including the very first one
          // (which subscription_created already sends a welcome email for).
          // billing_reason distinguishes "initial" from "renewal" payments.
          const billingReason = payload.data?.attributes?.billing_reason;
          if (billingReason && billingReason !== "initial") {
            const userSnap = await ref.get();
            const userEmail = userSnap.data()?.email;
            const renewsAt = payload.data?.attributes?.renews_at || null;
            if (userEmail) {
              sendRenewalEmail(userEmail, renewsAt).catch(err => console.error("Renewal email failed:", err));
            }
          }
          break;
        }
        case "subscription_cancelled": {
          // Auto-renew turned off — user keeps Pro until `ends_at`. The daily
          // cron job (subscriptionCron.js) is what actually flips plan to
          // "free" once ends_at passes.
          const endsAt = payload.data?.attributes?.ends_at || null;
          await ref.set(
            {
              plan: resolvePlan("cancelled", endsAt),
              subscription: {
                id: payload.data?.id,
                status: payload.data?.attributes?.status,
                cancelled: true,
                endsAt,
              },
            },
            { merge: true }
          );
          break;
        }
        case "subscription_expired": {
          await ref.set(
            {
              plan: "free",
              subscription: {
                id: payload.data?.id,
                status: payload.data?.attributes?.status,
                cancelled: true,
                endsAt: payload.data?.attributes?.ends_at || null,
              },
            },
            { merge: true }
          );
          break;
        }
        default:
          console.log("Unhandled Lemon Squeezy event:", eventName);
      }

      return res.status(200).json({ received: true });
    } catch (err) {
      console.error("Webhook error:", err);
      return res.status(500).json({ error: "Webhook processing failed." });
    }
  }
);

export default router;