import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

const APP_URL = "https://eloria-trial.vercel.app/"; // replace with your real domain

/**
 * Share a chat — saves it to sharedChats/{shareId} in Firestore.
 * Returns the full shareable URL.
 */
export async function shareChat(chat, ownerUser) {
  const shareId = `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  await setDoc(doc(db, "sharedChats", shareId), {
    type: "chat",
    shareId,
    title: chat.title || "Shared Chat",
    messages: chat.messages || [],
    ownerUid: ownerUser?.uid || null,
    ownerName: ownerUser?.displayName || ownerUser?.email || "Someone",
    createdAt: serverTimestamp(),
  });

  return `${APP_URL}?share=${shareId}`;
}

/**
 * Share a project (group of chats) — saves to sharedChats/{shareId}.
 * Returns the full shareable URL.
 */
export async function shareProject(project, chats, ownerUser) {
  const shareId = `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // Attach the actual chat objects that belong to this project
  const projectChats = (project.chatIds || [])
    .map(id => chats.find(c => c.id === id))
    .filter(Boolean);

  await setDoc(doc(db, "sharedChats", shareId), {
    type: "project",
    shareId,
    title: project.name || "Shared Project",
    projectChats,
    ownerUid: ownerUser?.uid || null,
    ownerName: ownerUser?.displayName || ownerUser?.email || "Someone",
    createdAt: serverTimestamp(),
  });

  return `${APP_URL}?share=${shareId}`;
}

/**
 * Load a shared chat/project by its shareId.
 * Returns the data object or null if not found.
 */
export async function loadShared(shareId) {
  const snap = await getDoc(doc(db, "sharedChats", shareId));
  if (!snap.exists()) return null;
  return snap.data();
}