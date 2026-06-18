import { doc, getDoc, updateDoc } from "firebase/firestore";
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

  await updateDoc(ref, {
    chats: chats
  });
}