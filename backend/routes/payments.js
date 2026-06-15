import express from "express";
import crypto from "crypto";
import { verifyUser } from "../middleware/auth.js";
import { createCheckout } from "../services/lemonsqueezy.js";
import { db } from "../config/firebaseAdmin.js";

const router = express.Router();

/**
 * POST /api/payments/checkout
 * Body: { plan: "pro_monthly" | "pro_yearly" }
 *
 * Creates a Lemon Squeezy checkout URL for the logged-in user
 * and returns it so the frontend can redirect to it.
 */
router.post("/checkout", express.json(), verifyUser, async (req, res) => {
  try {
    const { plan } = req.body;

    const variantMap = {
      pro_monthly: process.env.LEMONSQUEEZY_VARIANT_PRO_MONTHLY,
      pro_yearly: process.env.LEMONSQUEEZY_VARIANT_PRO_YEARLY,
    };

    const variantId = variantMap[plan];

    if (!variantId) {
      return res.status(400).json({ error: "Invalid or unconfigured plan." });
    }

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

/**
 * POST /api/payments/webhook
 *
 * Lemon Squeezy webhook receiver. Verifies the X-Signature header
 * against the raw request body using the signing secret, then
 * updates the user's plan in Firestore based on subscription events.
 *
 * IMPORTANT: this route must receive the RAW request body (not JSON-parsed)
 * for signature verification to work. It's mounted with express.raw()
 * in server.js BEFORE the global express.json() middleware applies to it.
 */
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    try {
      const signature = req.headers["x-signature"];
      const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;

      if (!signature || !secret) {
        return res.status(401).json({ error: "Missing signature." });
      }

      const hmac = crypto.createHmac("sha256", secret);
      const digest = hmac.update(req.body).digest("hex");

      const isValid = crypto.timingSafeEqual(
        Buffer.from(digest, "utf8"),
        Buffer.from(signature, "utf8")
      );

      if (!isValid) {
        return res.status(401).json({ error: "Invalid signature." });
      }

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
          // Active or trialing -> Pro. Anything else (cancelled, expired, etc) -> Free.
          const isActive = status === "active" || status === "on_trial";

          await ref.set(
            {
              plan: isActive ? "pro" : "free",
              subscription: {
                id: payload.data?.id,
                status,
                renewsAt: payload.data?.attributes?.renews_at || null,
                endsAt: payload.data?.attributes?.ends_at || null,
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