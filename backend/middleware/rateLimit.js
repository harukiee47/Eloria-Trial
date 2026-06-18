import { getUserUsage } from "../services/usageTracker.js";
import { getLimitsForUser } from "../services/limits.js";

/**
 * Generic factory: checks whether the user has remaining quota
 * for a given usage type (messages, codeRequests, imageRequests, voiceTurns).
 * Attaches `req.userData` and `req.limits` for downstream handlers
 * so they don't need to re-fetch from Firestore.
 */
function makeLimitChecker(usageType, errorMessage) {
  return async function (req, res, next) {
    try {
      const user = await getUserUsage(req.user.uid);
      const limits = getLimitsForUser(user);

      if (user.usage[usageType] >= limits[usageType]) {
        return res.status(429).json({
          error: errorMessage,
        });
      }

      req.userData = user;
      req.limits = limits;

      next();
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to check limits." });
    }
  };
}

export const checkMessageLimit = makeLimitChecker(
  "messages",
  "Daily message limit reached."
);

export const checkCodeLimit = makeLimitChecker(
  "codeRequests",
  "Daily code limit reached."
);

export const checkImageLimit = makeLimitChecker(
  "imageRequests",
  "Daily image limit reached."
);

export const checkVoiceLimit = makeLimitChecker(
  "voiceTurns",
  "Daily voice limit reached."
);

/**
 * Blocks free-plan users from Eloria Code entirely.
 * Place this BEFORE checkCodeLimit in the route chain.
 */
export async function requirePro(req, res, next) {
  try {
    const user = await getUserUsage(req.user.uid);
    const limits = getLimitsForUser(user);

    if (!limits.eloriaCodeAccess) {
      return res.status(403).json({
        error: "Upgrade to Pro to use Eloria Code.",
      });
    }

    req.userData = user;
    req.limits = limits;

    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to verify membership." });
  }
}