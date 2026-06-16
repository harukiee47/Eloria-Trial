// src/services/dmService.js
import { db } from "./firebase";
import {
  doc, getDoc, setDoc, collection, addDoc, query, orderBy,
  onSnapshot, serverTimestamp, where,
} from "firebase/firestore";

// Deterministic dmId so both users always land in the same thread,
// regardless of who opens it first.
export function getDmId(uid1, uid2) {
  return [uid1, uid2].sort().join("_");
}

export async function getOrCreateDM(uid1, uid2) {
  const dmId = getDmId(uid1, uid2);
  const ref = doc(db, "dms", dmId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      participants: [uid1, uid2].sort(),
      createdAt: serverTimestamp(),
      lastMessage: null,
    });
  }
  return dmId;
}

export async function sendDM(dmId, fromUid, text, file = null) {
  const msgData = {
    senderId: fromUid,
    createdAt: serverTimestamp(),
  };

  if (file) {
    msgData.fileType = file.type;       // "image" or "file"
    msgData.fileUrl = file.url;
    msgData.fileName = file.name;
    msgData.fileSize = file.size;
    msgData.fileMimeType = file.mimeType;
    msgData.text = null;
  } else {
    msgData.text = text?.trim() || "";
  }

  await addDoc(collection(db, "dms", dmId, "messages"), msgData);

  await setDoc(doc(db, "dms", dmId), {
    lastMessage: {
      text: file ? `📎 ${file.name}` : text?.trim(),
      senderId: fromUid,
      at: serverTimestamp(),
    },
  }, { merge: true });
}

export function subscribeToDMMessages(dmId, callback) {
  const q = query(
    collection(db, "dms", dmId, "messages"),
    orderBy("createdAt", "asc")
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

// Lists DM threads the user participates in (for a DM list sidebar item).
export function subscribeToMyDMs(uid, callback) {
  const q = query(
    collection(db, "dms"),
    where("participants", "array-contains", uid)
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}