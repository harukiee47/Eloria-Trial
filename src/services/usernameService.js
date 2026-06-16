// src/services/usernameService.js
import { db } from "./firebase";
import { doc, getDoc, setDoc, runTransaction } from "firebase/firestore";

// Allowed: letters, numbers, and . , _ ! @
const USERNAME_REGEX = /^[A-Za-z0-9.,_!@]+$/;

export function validateUsernameFormat(username) {
  if (!username || !username.trim()) {
    return "Username is required.";
  }
  const trimmed = username.trim();
  if (trimmed.length < 3) {
    return "Username must be at least 3 characters.";
  }
  if (trimmed.length > 24) {
    return "Username must be 24 characters or fewer.";
  }
  if (!USERNAME_REGEX.test(trimmed)) {
    return "Only letters, numbers, and . , _ ! @ are allowed.";
  }
  return null; // valid
}

export async function isUsernameTaken(username) {
  const ref = doc(db, "usernames", username.trim().toLowerCase());
  const snap = await getDoc(ref);
  return snap.exists();
}

// Atomically claims a username for a uid. Throws if already taken
// or if the format is invalid. Safe against race conditions because
// it uses a transaction + Firestore rules block any overwrite.
export async function claimUsername(uid, username) {
  const trimmed = username.trim();
  const formatError = validateUsernameFormat(trimmed);
  if (formatError) throw new Error(formatError);

  const lower = trimmed.toLowerCase();
  // Lock on the lowercase form so "John" and "john" can't both be claimed.
  const lockRef = doc(db, "usernames", lower);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(lockRef);
    if (snap.exists()) {
      throw new Error("That username is already taken.");
    }
    tx.set(lockRef, { uid, username: trimmed, usernameLower: lower });
  });

  return trimmed;
}

// Releases a username (e.g. if user wants to change it later).
// Not used in initial setup but kept for future "change username" feature.
export async function releaseUsername(username) {
  // Intentionally a no-op for now — rules disallow delete/update
  // on usernames docs to guarantee uniqueness history. If you want
  // username changes later, this needs a Cloud Function with admin
  // privileges, not a client-side call.
  throw new Error("Username changes must go through support for now.");
}