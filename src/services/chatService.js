import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";
/* =========================
   CLOUD CHAT STORAGE
========================= */

// LOAD chats from Firebase
export async function loadChats(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) return [];

  return snap.data().chats || [];
}

// SAVE chats to Firebase
export async function saveChats(uid, chats) {
  const ref = doc(db, "users", uid);

  // Single merge write: only touches the `chats` field, never reads-then-
  // overwrites the whole doc. This means it can never wipe out role/plan/
  // usage (or anything else), and removes the redundant double write that
  // used to fire on every call.
  await setDoc(ref, { chats }, { merge: true });
}