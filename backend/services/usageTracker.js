import { db } from "../config/firebaseAdmin.js";

function todayString() {
  return new Date().toISOString().split("T")[0];
}

function freshUsage() {
  return {
    date: todayString(),
    messages: 0,
    codeRequests: 0,
    imageRequests: 0,
  };
}

/**
 * Fetches the user's doc, creating it if it doesn't exist,
 * and resets usage counters if the stored date is not today.
 */
export async function getUserUsage(uid) {
  const ref = db.collection("users").doc(uid);
  const snap = await ref.get();

  if (!snap.exists) {
    const data = {
      plan: "free",
      role: "user",
      usage: freshUsage(),
    };

    await ref.set(data);
    return data;
  }

  const data = snap.data();

  if (!data.usage || data.usage.date !== todayString()) {
    data.usage = freshUsage();

    await ref.set({ usage: data.usage }, { merge: true });
  }

  return data;
}

/**
 * Atomically increments a usage counter for the user.
 * Always call getUserUsage first (e.g. in rateLimit middleware)
 * so the daily reset has already happened before this runs.
 */
export async function incrementUsage(uid, type) {
  const ref = db.collection("users").doc(uid);

  // Ensure today's usage object exists / is reset
  const user = await getUserUsage(uid);

  const updatedUsage = {
    ...user.usage,
    [type]: (user.usage[type] || 0) + 1,
  };

  await ref.set({ usage: updatedUsage }, { merge: true });

  return updatedUsage;
}