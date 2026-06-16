// src/services/friendService.js
import { db } from "./firebase";
import {
  collection, doc, getDocs, getDoc, query, where, limit,
  updateDoc, arrayUnion, arrayRemove, onSnapshot,
} from "firebase/firestore";
import { writeNotification } from "./notificationService";

// Prefix search on username (case-sensitive exact-prefix match,
// since usernames preserve case as typed at signup).
export async function searchUsersByUsername(searchTerm, excludeUid) {
  const trimmed = searchTerm.trim().toLowerCase();
  if (!trimmed) return [];

  const q = query(
    collection(db, "users"),
    where("usernameLower", ">=", trimmed),
    where("usernameLower", "<=", trimmed + "\uf8ff"),
    limit(10)
  );
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ uid: d.id, ...d.data() }))
    .filter(u => u.uid !== excludeUid && u.username);
}

export async function sendFriendRequest(fromUid, fromUsername, toUid) {
  if (fromUid === toUid) throw new Error("You can't add yourself.");

  const toRef = doc(db, "users", toUid);
  const toSnap = await getDoc(toRef);
  if (!toSnap.exists()) throw new Error("User not found.");
  const toData = toSnap.data();

  if ((toData.friends || []).includes(fromUid)) {
    throw new Error("You're already friends.");
  }
  if ((toData.pendingFriendRequests || []).includes(fromUid)) {
    throw new Error("Friend request already sent.");
  }

  await updateDoc(toRef, {
    pendingFriendRequests: arrayUnion(fromUid),
  });
  await updateDoc(doc(db, "users", fromUid), {
    sentFriendRequests: arrayUnion(toUid),
  });

  await writeNotification(toUid, "friend_request", {
    fromUid,
    fromUsername,
  });
}

export async function acceptFriendRequest(myUid, myUsername, fromUid) {
  await updateDoc(doc(db, "users", myUid), {
    friends: arrayUnion(fromUid),
    pendingFriendRequests: arrayRemove(fromUid),
  });
  await updateDoc(doc(db, "users", fromUid), {
    friends: arrayUnion(myUid),
    sentFriendRequests: arrayRemove(myUid),
  });
  await writeNotification(fromUid, "friend_accepted", {
    fromUid: myUid,
    fromUsername: myUsername,
  });
}

export async function declineFriendRequest(myUid, fromUid) {
  await updateDoc(doc(db, "users", myUid), {
    pendingFriendRequests: arrayRemove(fromUid),
  });
  await updateDoc(doc(db, "users", fromUid), {
    sentFriendRequests: arrayRemove(myUid),
  });
}

export async function removeFriend(myUid, otherUid) {
  await updateDoc(doc(db, "users", myUid), {
    friends: arrayRemove(otherUid),
  });
  await updateDoc(doc(db, "users", otherUid), {
    friends: arrayRemove(myUid),
  });
}

export async function cancelSentRequest(myUid, toUid) {
  await updateDoc(doc(db, "users", myUid), {
    sentFriendRequests: arrayRemove(toUid),
  });
  await updateDoc(doc(db, "users", toUid), {
    pendingFriendRequests: arrayRemove(myUid),
  });
}

// Subscribes to my own profile, then resolves friends/requests into
// full user objects (with username, online, lastSeen) for display.
export function subscribeToFriendsData(uid, callback) {
  const ref = doc(db, "users", uid);
  return onSnapshot(ref, async (snap) => {
    if (!snap.exists()) return callback({ friends: [], received: [], sent: [] });
    const data = snap.data();

    const resolve = async (uids) => {
      const results = await Promise.all(
        (uids || []).map(async (id) => {
          const s = await getDoc(doc(db, "users", id));
          return s.exists() ? { uid: id, ...s.data() } : null;
        })
      );
      return results.filter(Boolean);
    };

    const [friends, received, sent] = await Promise.all([
      resolve(data.friends),
      resolve(data.pendingFriendRequests),
      resolve(data.sentFriendRequests),
    ]);

    callback({ friends, received, sent });
  });
}

// Formats "Active now" / "Active 10m ago" / "Active 3d ago"
export function formatLastSeen(online, lastSeen) {
  if (online) return "Active now";
  if (!lastSeen) return "Offline";
  const ts = lastSeen.toDate ? lastSeen.toDate() : new Date(lastSeen);
  const diffMs = Date.now() - ts.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Active just now";
  if (mins < 60) return `Active ${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Active ${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `Active ${days}d ago`;
}