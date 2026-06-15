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

  const snap = await getDoc(ref);

  const prev = snap.exists() ? snap.data() : {};

  await setDoc(ref, {
    ...prev,
    chats
  });

  await setDoc(ref, { chats }, { merge: true });
}