import express from "express";
import { verifyUser } from "../middleware/auth.js";
import { db } from "../config/firebaseAdmin.js";
import { getUserUsage } from "../services/usageTracker.js";
import { getLimitsForUser } from "../services/limits.js";
import { runSubscriptionCheck } from "../services/subscriptionCron.js";

const router = express.Router();

router.get("/status", verifyUser, async (req, res) => {
  try {
    const user = await getUserUsage(req.user.uid);
    const limits = getLimitsForUser(user);

    return res.json({
      plan: user.plan,
      role: user.role,
      usage: user.usage,
      limits,
      subscription: user.subscription || null,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch membership status." });
  }
});

// TEMPORARY — for testing only, remove before real users use the app
router.post("/dev/run-check", verifyUser, async (req, res) => {
  await runSubscriptionCheck();
  res.json({ done: true });
});

export default router;