import express from "express";
import { verifyUser } from "../middleware/auth.js";
import { db } from "../config/firebaseAdmin.js";
import { getUserUsage } from "../services/usageTracker.js";
import { getLimitsForUser } from "../services/limits.js";

const router = express.Router();

/**
 * GET /api/membership/status
 * Returns the user's plan, role, current usage, and their limits.
 */
router.get("/status", verifyUser, async (req, res) => {
  try {
    const user = await getUserUsage(req.user.uid);
    const limits = getLimitsForUser(user);

    return res.json({
      plan: user.plan,
      role: user.role,
      usage: user.usage,
      limits,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch membership status." });
  }
});

/**
 * POST /api/membership/upgrade
 * Body: { plan: "pro" }
 *
 * NOTE: This is a placeholder for manually setting a plan.
 * In production, this should be triggered by a verified payment
 * webhook (Stripe, etc.), NOT called directly by the client,
 * since a user could otherwise upgrade themselves for free.
 * Keep this behind admin auth or remove it once payments are wired up.
 */
router.post("/upgrade", verifyUser, async (req, res) => {
  try {
    const { plan } = req.body;

    if (!["free", "pro"].includes(plan)) {
      return res.status(400).json({ error: "Invalid plan." });
    }

    const ref = db.collection("users").doc(req.user.uid);
    await ref.set({ plan }, { merge: true });

    return res.json({ success: true, plan });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to update membership." });
  }
});

export default router;