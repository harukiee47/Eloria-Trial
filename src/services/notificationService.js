// src/services/notificationService.js
import { db } from "./firebase";
import {
  collection, addDoc, updateDoc, doc,
  query, where, onSnapshot, serverTimestamp,
} from "firebase/firestore";

// type must be one of the values your Firestore rules allow
export async function writeNotification(toUid, type, { fromUid, fromUsername, payload } = {}) {
  const data = {
    toUid,
    type,          // "friendRequest" | "friendAccepted" | "mention" | "groupInvite"
    fromUid,
    fromUsername: fromUsername || "",
    read: false,
    createdAt: serverTimestamp(),
  };

  if (payload) data.payload = payload;

  await addDoc(collection(db, "notifications"), data);
}

export async function markRead(notifId) {
  await updateDoc(doc(db, "notifications", notifId), { read: true });
}

export async function markAllRead(notifIds) {
  const promises = notifIds.map(id =>
    updateDoc(doc(db, "notifications", id), { read: true })
  );
  await Promise.all(promises);
}

export function subscribeToNotifications(uid, callback) {
  const q = query(
    collection(db, "notifications"),
    where("toUid", "==", uid),
    where("read", "==", false)
  );
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    (err) => console.error("❌ subscribeToNotifications:", err.message)
  );
}

export async function markNotificationRead(notifId) {
  await updateDoc(doc(db, "notifications", notifId), { read: true });
}