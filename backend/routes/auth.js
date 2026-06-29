import express from "express";
import { auth } from "../config/firebaseAdmin.js";
import { verifyUser } from "../middleware/auth.js";

const router = express.Router();

router.post("/custom-token", express.json(), verifyUser, async (req, res) => {
  try {
    const customToken = await auth.createCustomToken(req.user.uid);
    return res.json({ customToken });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to create custom token." });
  }
});

export default router;