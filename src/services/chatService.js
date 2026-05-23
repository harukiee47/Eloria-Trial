import { db } from "./firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

/* =========================
   AI MESSAGE API (your current code)
========================= */
export async function sendMessageToAMK(message) {
  const res = await fetch("https://eloria-trial.onrender.com/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });

  let data;

  try {
    data = await res.json();
  } catch (err) {
    data = null;
  }

  return (
    data?.reply ||
    data?.message ||
    "Eloria is unable to respond right now."
  );
}

/* =========================
   CLOUD CHAT STORAGE
========================= */

// LOAD chats from Firebase
export async function loadChats(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);

  return snap.exists() ? snap.data().chats || [] : [];
}

// SAVE chats to Firebase
export async function saveChats(uid, chats) {
  const { doc, setDoc } = await import("firebase/firestore");
  const { db } = await import("./firebase");

  for (const chat of chats) {
    await setDoc(
      doc(db, "users", uid, "chats", String(chat.id)),
      chat
    );
  }
}