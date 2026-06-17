import {
  doc, getDoc, setDoc, updateDoc, collection,
  onSnapshot, query, where, serverTimestamp,
  arrayUnion, arrayRemove, addDoc, getDocs,
} from "firebase/firestore";
import { db } from "./firebase";

// ── Create or update user profile in Firestore ──────────────────────────────
export async function upsertUserProfile(user, username) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      uid: user.uid,
      email: user.email,
      username: username || user.displayName || user.email.split("@")[0],
      friends: [],
      pendingFriendRequests: [],
      sentFriendRequests: [],
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

// ── Get user profile by email ────────────────────────────────────────────────
export async function getUserByEmail(email) {
  const q = query(collection(db, "users"), where("email", "==", email));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

// ── Subscribe to own profile (for username, friend lists) ───────────────────
export function subscribeToMyProfile(uid, callback) {
  return onSnapshot(doc(db, "users", uid), (snap) => {
    if (snap.exists()) callback({ id: snap.id, ...snap.data() });
  });
}

// ── Set online / offline ─────────────────────────────────────────────────────
export async function setOnlineStatus(uid, online) {
  await updateDoc(doc(db, "users", uid), {
    online,
    lastSeen: serverTimestamp(),
  });
}

// ── Subscribe to a list of users by uid (for friends panel) ─────────────────
export function subscribeToUsers(uids, callback) {
  if (!uids || uids.length === 0) { callback([]); return () => {}; }
  const q = query(collection(db, "users"), where("uid", "in", uids));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

// ── Send a friend request ────────────────────────────────────────────────────
export async function sendFriendRequest(fromUid, toEmail) {
  const target = await getUserByEmail(toEmail);
  if (!target) throw new Error("No user found with that email.");
  if (target.uid === fromUid) throw new Error("You can't add yourself.");

  const myRef     = doc(db, "users", fromUid);
  const targetRef = doc(db, "users", target.uid);

  const mySnap = await getDoc(myRef);
  const me = mySnap.data();

  if (me.friends?.includes(target.uid)) throw new Error("Already friends.");
  if (me.sentFriendRequests?.includes(target.uid)) throw new Error("Request already sent.");
  if (me.pendingFriendRequests?.includes(target.uid)) {
    await acceptFriendRequest(fromUid, target.uid);
    return { autoAccepted: true };
  }

  await updateDoc(myRef, { sentFriendRequests: arrayUnion(target.uid) });
  await updateDoc(targetRef, { pendingFriendRequests: arrayUnion(fromUid) });

  await addDoc(collection(db, "notifications"), {
    type: "friendRequest",
    fromUid,
    fromUsername: me.username || me.email,
    toUid: target.uid,
    read: false,
    createdAt: serverTimestamp(),
  });

  return { autoAccepted: false };
}

// ── Accept a friend request ──────────────────────────────────────────────────
export async function acceptFriendRequest(myUid, fromUid) {
  const myRef   = doc(db, "users", myUid);
  const fromRef = doc(db, "users", fromUid);

  await updateDoc(myRef, {
    friends: arrayUnion(fromUid),
    pendingFriendRequests: arrayRemove(fromUid),
  });
  await updateDoc(fromRef, {
    friends: arrayUnion(myUid),
    sentFriendRequests: arrayRemove(myUid),
  });

  // Mark the original friend request notification as read
  const q = query(
    collection(db, "notifications"),
    where("type", "==", "friendRequest"),
    where("fromUid", "==", fromUid),
    where("toUid", "==", myUid),
    where("read", "==", false)
  );
  const snap = await getDocs(q);
  snap.docs.forEach(d => updateDoc(d.ref, { read: true }));
}

// ── Decline a friend request ─────────────────────────────────────────────────
export async function declineFriendRequest(myUid, fromUid) {
  const myRef   = doc(db, "users", myUid);
  const fromRef = doc(db, "users", fromUid);

  await updateDoc(myRef, { pendingFriendRequests: arrayRemove(fromUid) });
  await updateDoc(fromRef, { sentFriendRequests: arrayRemove(myUid) });

  const q = query(
    collection(db, "notifications"),
    where("type", "==", "friendRequest"),
    where("fromUid", "==", fromUid),
    where("toUid", "==", myUid),
    where("read", "==", false)
  );
  const snap = await getDocs(q);
  snap.docs.forEach(d => updateDoc(d.ref, { read: true }));
}

// ── Subscribe to notifications ───────────────────────────────────────────────
export function subscribeToNotifications(uid, userEmail, callback) {
  const q = query(
    collection(db, "notifications"),
    where("toUid", "==", uid),
    where("read", "==", false)
  );
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

// ── Write a mention notification ─────────────────────────────────────────────
export async function writeMentionNotification(groupId, groupName, fromUid, fromUsername, toUid, messageText) {
  if (fromUid === toUid) return;
  await addDoc(collection(db, "notifications"), {
    type: "mention",
    fromUid,
    fromUsername,
    toUid,
    read: false,
    createdAt: serverTimestamp(),
    payload: { groupId, groupName, messageText: messageText.slice(0, 80) },
  });
}

// ── Mark a notification as read ──────────────────────────────────────────────
export async function markNotificationRead(notifId) {
  await updateDoc(doc(db, "notifications", notifId), { read: true });
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