import {
  collection, doc, addDoc, getDoc, getDocs,
  updateDoc, deleteDoc, onSnapshot, arrayUnion,
  arrayRemove, query, orderBy, serverTimestamp,
  where, writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";

// ── Plan limits ──────────────────────────────────────────────────────────────
export const GROUP_LIMITS = {
  free:  { maxGroups: 0, maxMembers: 0 },
  pro:   { maxGroups: 4, maxMembers: 6 },
  admin: { maxGroups: 99, maxMembers: 99 },
};

// ── Create a group ───────────────────────────────────────────────────────────
export async function createGroup(user, groupName, userPlan) {
  const limits = GROUP_LIMITS[userPlan] || GROUP_LIMITS.free;

  if (userPlan !== "pro" && userPlan !== "admin") {
    throw new Error("Groups are a Pro feature. Upgrade to create and join groups.");
  }

  const existing = await getDocs(
    query(collection(db, "groups"), where("members", "array-contains", user.uid))
  );
  if (existing.size >= limits.maxGroups) {
    throw new Error(
      `You can only be in ${limits.maxGroups} group${limits.maxGroups > 1 ? "s" : ""} on the Pro plan.`
    );
  }

  const groupRef = await addDoc(collection(db, "groups"), {
    memberUsernames: { [user.uid]: user.username || user.displayName || user.email.split("@")[0] },
    name: groupName.trim() || "New Group",
    creatorId: user.uid,
    members: [user.uid],
    memberEmails: [user.email],
    memberNames: { [user.uid]: user.displayName || user.email },
    memberJoinedAt: { [user.uid]: new Date().toISOString() },
    pendingInvites: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastMessage: null,
    unreadCounts: {},
    plan: userPlan,
  });

  return groupRef.id;
}

// ── Subscribe to groups where user is a member ───────────────────────────────
export function subscribeToGroups(uid, callback) {
  const q = query(
    collection(db, "groups"),
    where("members", "array-contains", uid)
  );
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    (err) => console.error("❌ subscribeToGroups:", err.message)
  );
}

// ── Subscribe to messages in a group ─────────────────────────────────────────
export function subscribeToMessages(groupId, joinedAtISO, callback) {
  const q = query(
    collection(db, "groups", groupId, "messages"),
    orderBy("timestamp", "asc")
  );
  return onSnapshot(q, (snap) => {
    const messages = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    const userJoinedAt = joinedAtISO ? new Date(joinedAtISO) : null;
    const filtered = messages.filter(msg => {
      if (!userJoinedAt || isNaN(userJoinedAt.getTime())) return true;
      if (!msg.timestamp) return true;
      const msgTime = msg.timestamp?.toDate
        ? msg.timestamp.toDate()
        : new Date(msg.timestamp);
      if (isNaN(msgTime.getTime())) return true;
      return msgTime >= userJoinedAt;
    });

    callback(filtered);
  });
}

// ── Send a message ───────────────────────────────────────────────────────────
export async function sendGroupMessage(groupId, user, text, replyTo = null) {
  const msgData = {
    text,
    senderId: user.uid,
    senderName: user.displayName || user.email,
    senderInitial: (user.displayName || user.email || "?")[0].toUpperCase(),
    isEloria: false,
    timestamp: serverTimestamp(),
  };

  if (replyTo) {
    msgData.replyTo = {
      id: replyTo.id,
      text: replyTo.text?.slice(0, 80) || "",
      senderName: replyTo.isEloria ? "Eloria" : replyTo.senderName,
    };
  }

  const msgRef = await addDoc(
    collection(db, "groups", groupId, "messages"),
    msgData
  );

  const groupSnap = await getDoc(doc(db, "groups", groupId));
  const group = groupSnap.data();
  const unreadCounts = { ...(group.unreadCounts || {}) };
  group.members.forEach(uid => {
    if (uid !== user.uid) {
      unreadCounts[uid] = (unreadCounts[uid] || 0) + 1;
    }
  });

  await updateDoc(doc(db, "groups", groupId), {
    lastMessage: {
      text,
      senderName: user.displayName || user.email,
      timestamp: serverTimestamp(),
    },
    updatedAt: serverTimestamp(),
    unreadCounts,
  });

  return msgRef.id;
}

// ── Delete a message ──────────────────────────────────────────────────────────
export async function deleteGroupMessage(groupId, messageId) {
  await deleteDoc(doc(db, "groups", groupId, "messages", messageId));
}

// ── Clear unread count for a user ────────────────────────────────────────────
export async function clearUnread(groupId, uid) {
  await updateDoc(doc(db, "groups", groupId), {
    [`unreadCounts.${uid}`]: 0,
  });
}

// ── Invite a user by email ────────────────────────────────────────────────────
export async function inviteToGroup(groupId, user, targetUsername, userPlan) {
  // 1. Look up the target user by username
  const usersSnap = await getDocs(
    query(collection(db, "users"), where("username", "==", targetUsername))
  );
  if (usersSnap.empty) {
    throw new Error(`No user found with username "@${targetUsername}".`);
  }
  const targetUserDoc = usersSnap.docs[0];
  const targetUid   = targetUserDoc.id;
  const targetData  = targetUserDoc.data();
  const targetEmail = targetData.email || "";

  // 2. Check group limits
  const groupSnap = await getDoc(doc(db, "groups", groupId));
  if (!groupSnap.exists()) throw new Error("Group not found.");
  const group = groupSnap.data();

  const limits = GROUP_LIMITS[userPlan] || GROUP_LIMITS.free;
  if (group.members.length >= limits.maxMembers) {
    throw new Error(`This group is full (max ${limits.maxMembers} members on ${userPlan} plan).`);
  }
  if (group.members.includes(targetUid)) {
    throw new Error("That user is already in the group.");
  }
  if (group.pendingInvites?.includes(targetUid)) {
    throw new Error("An invite is already pending for that user.");
  }
  if (targetUid === user.uid) {
    throw new Error("You can't invite yourself.");
  }

  // 3. Add to pendingInvites and create invite doc
  await updateDoc(doc(db, "groups", groupId), {
    pendingInvites: arrayUnion(targetUid),
  });

  await addDoc(collection(db, "invites"), {
    fromUid:      user.uid,
    fromEmail:    user.email    || "",
    fromUsername: user.username || user.displayName || "",
    toUid:        targetUid,
    toEmail:      targetEmail,
    toUsername:   targetUsername,
    groupId,
    groupName: group.name,
    createdAt: serverTimestamp(),
    status: "pending",
  });
}

// ── Subscribe to pending invites for a user ──────────────────────────────────
export function subscribeToInvites(userEmail, callback, userUid) {
  const field = userUid ? "toUid" : "toEmail";
  const value = userUid || userEmail;
  const q = query(
    collection(db, "invites"),
    where(field, "==", value),
    where("status", "==", "pending")
  );
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    (err) => console.error("❌ subscribeToInvites:", err.message)
  );
}

// ── Accept an invite ──────────────────────────────────────────────────────────
export async function acceptInvite(inviteId, user) {
  const inviteSnap = await getDoc(doc(db, "invites", inviteId));
  if (!inviteSnap.exists()) throw new Error("Invite not found.");
  const invite = inviteSnap.data();

  const groupSnap = await getDoc(doc(db, "groups", invite.groupId));
  if (!groupSnap.exists()) throw new Error("Group no longer exists.");

  const batch = writeBatch(db);
  const joinedAtISO = new Date().toISOString();

  batch.update(doc(db, "groups", invite.groupId), {
    [`memberUsernames.${user.uid}`]: user.username || user.displayName || user.email.split("@")[0],
    members: arrayUnion(user.uid),
    memberEmails: arrayUnion(user.email),
    [`memberNames.${user.uid}`]: user.displayName || user.email,
    pendingInvites: arrayRemove(user.uid),
    [`memberJoinedAt.${user.uid}`]: joinedAtISO,
  });

  batch.update(doc(db, "invites", inviteId), {
    status: "accepted",
    acceptedAt: serverTimestamp(),
  });

  await batch.commit();
  return invite.groupId;
}

// ── Decline an invite ─────────────────────────────────────────────────────────
export async function declineInvite(inviteId, userUid) {
  const inviteSnap = await getDoc(doc(db, "invites", inviteId));
  if (!inviteSnap.exists()) return;
  const invite = inviteSnap.data();

  await updateDoc(doc(db, "groups", invite.groupId), {
    pendingInvites: arrayRemove(userUid),
  });
  await updateDoc(doc(db, "invites", inviteId), { status: "declined" });
}

// ── Leave a group ─────────────────────────────────────────────────────────────
export async function leaveGroup(groupId, user) {
  await updateDoc(doc(db, "groups", groupId), {
    members: arrayRemove(user.uid),
    memberEmails: arrayRemove(user.email),
  });
}

// ── Kick a member (creator only) ──────────────────────────────────────────────
export async function kickMember(groupId, targetUid, targetEmail) {
  await updateDoc(doc(db, "groups", groupId), {
    members: arrayRemove(targetUid),
    memberEmails: arrayRemove(targetEmail),
  });
}

// ── Rename group (creator only) ───────────────────────────────────────────────
export async function renameGroup(groupId, newName) {
  await updateDoc(doc(db, "groups", groupId), {
    name: newName.trim(),
    updatedAt: serverTimestamp(),
  });
}

// ── Delete a group (creator only) ────────────────────────────────────────────
export async function deleteGroup(groupId) {
  const msgs = await getDocs(collection(db, "groups", groupId, "messages"));
  const batch = writeBatch(db);
  msgs.docs.forEach(d => batch.delete(d.ref));
  batch.delete(doc(db, "groups", groupId));
  await batch.commit();
}