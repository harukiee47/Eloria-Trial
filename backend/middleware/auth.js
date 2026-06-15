import { auth } from "../config/firebaseAdmin.js";

export async function verifyUser(req, res, next) {
  try {
    const header = req.headers.authorization;

    if (!header?.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Unauthorized",
      });
    }

    const token = header.split("Bearer ")[1];

    const decoded = await auth.verifyIdToken(token);

    req.user = {
      uid: decoded.uid,
      email: decoded.email,
      name: decoded.name,
    };

    next();
  } catch (error) {
    console.error(error);

    return res.status(401).json({
      error: "Invalid token",
    });
  }
}