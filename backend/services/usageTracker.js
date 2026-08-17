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
    voiceTurns: 0,
    githubActions: 0,     // ← added: counts approved write/create/delete actions
  };
}

/**
 * Fetches the user's doc, creating it if it doesn't exist,
 * and resets usage counters if the stored date is not today.
 */
export async function getUserUsage(uid) {
  const ref = db.collection("users").doc(uid);
  const snap = await ref.get();

  const data = snap.exists ? snap.data() : {};
  const patch = {};

  if (!data.plan) {
    data.plan = "free";
    patch.plan = data.plan;
  }
  if (!data.role) {
    data.role = "user";
    patch.role = data.role;
  }
  if (!data.usage || data.usage.date !== todayString()) {
    data.usage = freshUsage();
    patch.usage = data.usage;
  }

  if (Object.keys(patch).length > 0) {
    await ref.set(patch, { merge: true });
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

  const user = await getUserUsage(uid);

  const updatedUsage = {
    ...user.usage,
    [type]: (user.usage[type] || 0) + 1,
  };

  await ref.set({ usage: updatedUsage }, { merge: true });

  return updatedUsage;
}