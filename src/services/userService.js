import {
  doc, getDoc, setDoc, updateDoc,
  onSnapshot, serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";

// ── Create or update user profile in Firestore ──────────────────────────────
export async function upsertUserProfile(user, displayName) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      uid: user.uid,
      email: user.email,
      displayName: displayName || user.displayName || "",
      online: true,
      lastSeen: serverTimestamp(),
      createdAt: serverTimestamp(),
    });
  } else {
    await updateDoc(ref, {
      online: true,
      lastSeen: serverTimestamp(),
      email: user.email,
    });
  }
}

// ── Get a single user profile ────────────────────────────────────────────────
export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// ── Subscribe to own profile ─────────────────────────────────────────────────
export function subscribeToMyProfile(uid, callback) {
  return onSnapshot(
    doc(db, "users", uid),
    (snap) => { if (snap.exists()) callback({ id: snap.id, ...snap.data() }); },
    (err) => console.error("❌ subscribeToMyProfile:", err.message)
  );
}

// ── Set online / offline ─────────────────────────────────────────────────────
export async function setOnlineStatus(uid, online) {
  await updateDoc(doc(db, "users", uid), {
    online,
    lastSeen: serverTimestamp(),
  });
}

// ── Format lastSeen for display ──────────────────────────────────────────────
export function formatLastSeen(lastSeen) {
  if (!lastSeen) return "a while ago";
  const d = lastSeen?.toDate ? lastSeen.toDate() : new Date(lastSeen);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60)  return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}
