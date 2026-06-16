// src/services/notificationService.js
import { db } from "./firebase";
import {
  collection, addDoc, query, where, onSnapshot, orderBy, serverTimestamp,
} from "firebase/firestore";

const READ_KEY = "eloria_read_notifs";

function getReadSet() {
  try {
    return new Set(JSON.parse(localStorage.getItem(READ_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function saveReadSet(set) {
  localStorage.setItem(READ_KEY, JSON.stringify([...set]));
}

export function markRead(notifId) {
  const set = getReadSet();
  set.add(notifId);
  saveReadSet(set);
}

export function markAllRead(notifIds) {
  const set = getReadSet();
  notifIds.forEach(id => set.add(id));
  saveReadSet(set);
}

export function isRead(notifId) {
  return getReadSet().has(notifId);
}

// type: "friend_request" | "friend_accepted" | "mention" | "group_invite"
export async function writeNotification(toUid, type, payload) {
  await addDoc(collection(db, "notifications"), {
    toUid,
    type,
    ...payload,
    createdAt: serverTimestamp(),
  });
}

// Live subscription to all notifications for this user, newest first.
// Read/unread is computed client-side from localStorage.
export function subscribeToNotifications(uid, callback) {
  const q = query(
    collection(db, "notifications"),
    where("toUid", "==", uid),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, (snap) => {
    const readSet = getReadSet();
    const notifs = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      read: readSet.has(d.id),
    }));
    callback(notifs);
  });
}