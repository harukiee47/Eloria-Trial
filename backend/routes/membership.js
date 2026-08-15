import express from "express";
import { verifyUser } from "../middleware/auth.js";
import { db } from "../config/firebaseAdmin.js";
import { getUserUsage } from "../services/usageTracker.js";
import { getLimitsForUser } from "../services/limits.js";

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

export default router;