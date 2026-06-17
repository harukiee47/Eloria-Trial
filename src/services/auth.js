// src/services/auth.js
import { auth, googleProvider, db } from "./firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";

// ── Internal: create the bare Firestore profile (no username yet) ──────────
async function ensureUserProfile(firebaseUser) {
  const ref  = doc(db, "users", firebaseUser.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      uid:                   firebaseUser.uid,
      email:                 firebaseUser.email,
      displayName:           firebaseUser.displayName || "",
      username:              null,
      usernameSet:           false,
      friends:               [],
      pendingFriendRequests: [],
      sentFriendRequests:    [],
      online:                true,
      lastSeen:              serverTimestamp(),
      createdAt:             serverTimestamp(),
    });
    return { username: null, usernameSet: false, displayName: firebaseUser.displayName || "" };
  } else {
    const data = snap.data();
    await updateDoc(ref, { online: true, lastSeen: serverTimestamp() });
    return {
      username: data.username || null,
      usernameSet: !!data.usernameSet,
      displayName: data.displayName || firebaseUser.displayName || "",
    };
  }
}

// ── Listen to auth state changes ─────────────────────────────────────────────
export const checkAuth = (setUser) => {
  return onAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
      try {
        await firebaseUser.getIdToken(); // ← add this line right here

        const ref  = doc(db, "users", firebaseUser.uid);
        const snap = await getDoc(ref);
        const data = snap.exists() ? snap.data() : {};

        setUser({
          uid:         firebaseUser.uid,
          email:       firebaseUser.email,
          username:    data.username || null,
          usernameSet: !!data.usernameSet,
          displayName: data.displayName || firebaseUser.displayName || "",
        });
      } catch {
        setUser({
          uid:         firebaseUser.uid,
          email:       firebaseUser.email,
          username:    null,
          usernameSet: false,
          displayName: firebaseUser.displayName || "",
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

  const ref  = doc(db, "users", u.uid);
  const snap = await getDoc(ref);
  const data = snap.exists() ? snap.data() : {};

  if (snap.exists()) {
    await updateDoc(ref, { online: true, lastSeen: serverTimestamp() });
  }

  return {
    uid: u.uid,
    email: u.email,
    username: data.username || null,
    usernameSet: !!data.usernameSet,
    displayName: data.displayName || "",
  };
};

// ── Email + Password Signup ──────────────────────────────────────────────────
// NOTE: no username param anymore — that's handled by ProfileSetupModal
// after signup completes.
export const signupWithEmail = async (email, password) => {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const u    = cred.user;

  const profile = await ensureUserProfile(u);

  return { uid: u.uid, email: u.email, ...profile };
};

// ── Google Login ─────────────────────────────────────────────────────────────
export const loginWithGoogle = async () => {
  const result = await signInWithPopup(auth, googleProvider);
  const u      = result.user;

  const profile = await ensureUserProfile(u);

  return { uid: u.uid, email: u.email, ...profile };
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