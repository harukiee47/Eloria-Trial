import express from "express";
import crypto from "crypto";
import { verifyUser } from "../middleware/auth.js";
import { createCheckout } from "../services/lemonsqueezy.js";
import { db } from "../config/firebaseAdmin.js";

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

router.post("/cancel", verifyUser, async (req, res) => {
  try {
    const userDoc = await db.collection("users").doc(req.user.uid).get();
    const subId = userDoc.data()?.subscription?.id;
    if (!subId) return res.status(400).json({ error: "No active subscription found." });

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

    if (!response.ok) throw new Error(await response.text());

    await db.collection("users").doc(req.user.uid).set(
      { subscription: { ...userDoc.data().subscription, cancelled: true } },
      { merge: true }
    );

    return res.json({ success: true });
  } catch (err) {
    console.error("Cancel subscription error:", err);
    return res.status(500).json({ error: "Failed to cancel subscription." });
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

      switch (eventName) {
        case "subscription_created":
        case "subscription_updated": {
          const status = payload.data?.attributes?.status;
          const isActive = status === "active" || status === "on_trial";
          const isCancelled = payload.data?.attributes?.cancelled === true;

          await ref.set(
            {
              plan: isActive ? "pro" : "free",
              subscription: {
                id: payload.data?.id,
                status,
                cancelled: isCancelled,
                renewsAt: payload.data?.attributes?.renews_at || null,
                endsAt: payload.data?.attributes?.ends_at || null,
                reminderSent: false,
              },
            },
            { merge: true }
          );
          break;
        }
        case "subscription_cancelled":
        case "subscription_expired": {
          await ref.set(
            {
              plan: "free",
              subscription: {
                id: payload.data?.id,
                status: payload.data?.attributes?.status,
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