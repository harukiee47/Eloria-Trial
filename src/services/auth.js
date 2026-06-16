// src/services/auth.js
import { auth, googleProvider, db } from "./firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
  updateProfile,
} from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";

// ── Internal: save/update user profile in Firestore ─────────────────────────
async function ensureUserProfile(firebaseUser, username) {
  const ref  = doc(db, "users", firebaseUser.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    const resolvedUsername =
      username ||
      firebaseUser.displayName ||
      firebaseUser.email.split("@")[0];

    await setDoc(ref, {
      uid:                  firebaseUser.uid,
      email:                firebaseUser.email,
      username:             resolvedUsername,
      friends:              [],
      pendingFriendRequests: [],
      sentFriendRequests:   [],
      online:               true,
      lastSeen:             serverTimestamp(),
      createdAt:            serverTimestamp(),
    });
    return resolvedUsername;
  } else {
  const existingUsername = snap.data().username;
  const needsUsername = !existingUsername || existingUsername === snap.data().email;
  await updateDoc(ref, {
    online: true,
    lastSeen: serverTimestamp(),
    // Fix existing users who have email stored as username
    ...(needsUsername && firebaseUser.displayName
      ? { username: firebaseUser.displayName }
      : {}),
  });
  return needsUsername && firebaseUser.displayName
    ? firebaseUser.displayName
    : existingUsername || snap.data().email;
}
}

// ── Listen to auth state changes ─────────────────────────────────────────────
export const checkAuth = (setUser) => {
  return onAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
      // Load username from Firestore
      try {
        const ref  = doc(db, "users", firebaseUser.uid);
        const snap = await getDoc(ref);
        const username = snap.exists()
          ? snap.data().username
          : firebaseUser.displayName || firebaseUser.email.split("@")[0];

        setUser({
          uid:         firebaseUser.uid,
          email:       firebaseUser.email,
          username,
          displayName: username,
        });
      } catch {
        setUser({
          uid:         firebaseUser.uid,
          email:       firebaseUser.email,
          username:    firebaseUser.email.split("@")[0],
          displayName: firebaseUser.email.split("@")[0],
        });
      }
    } else {
      setUser(null);
    }
  });
};

// ── Email + Password Login ───────────────────────────────────────────────────
export const loginWithEmail = async (email, password) => {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const u    = cred.user;

  // Load username from Firestore
  const ref  = doc(db, "users", u.uid);
  const snap = await getDoc(ref);
  const username = snap.exists() ? snap.data().username : u.email.split("@")[0];

  // Update online status
  if (snap.exists()) {
    await updateDoc(ref, { online: true, lastSeen: serverTimestamp() });
  }

  return { uid: u.uid, email: u.email, username, displayName: username };
};

// ── Email + Password Signup ──────────────────────────────────────────────────
export const signupWithEmail = async (email, password, username) => {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const u    = cred.user;

  // Save displayName to Firebase Auth as well
  await updateProfile(u, { displayName: username || email.split("@")[0] });

  // Save to Firestore
  const resolvedUsername = await ensureUserProfile(u, username);

  return { uid: u.uid, email: u.email, username: resolvedUsername, displayName: resolvedUsername };
};

// ── Google Login ─────────────────────────────────────────────────────────────
export const loginWithGoogle = async () => {
  const result = await signInWithPopup(auth, googleProvider);
  const u      = result.user;

  const resolvedUsername = await ensureUserProfile(u, u.displayName);

  return { uid: u.uid, email: u.email, username: resolvedUsername, displayName: resolvedUsername };
};

// ── Logout ───────────────────────────────────────────────────────────────────
export const logout = async (uid) => {
  if (uid) {
    try {
      const { setOnlineStatus } = await import("./userService");
      await setOnlineStatus(uid, false);
    } catch {}
  }
  await signOut(auth);
};