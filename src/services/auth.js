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

const FIREBASE_API_KEY = "AIzaSyDmfVTBxzZgqdshD6ld91XSTImZ-LsS39A";
const isTauri = Boolean(window.__TAURI__);

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

// ── Internal: get Firestore user data by uid ─────────────────────────────────
async function getFirestoreUser(uid) {
  const ref  = doc(db, "users", uid);
  const snap = await getDoc(ref);
  const data = snap.exists() ? snap.data() : {};
  if (snap.exists()) {
    await updateDoc(ref, { online: true, lastSeen: serverTimestamp() });
  }
  return { snap, data };
}

// ── Listen to auth state changes ─────────────────────────────────────────────
export const checkAuth = (setUser) => {
  return onAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
      try {
        await firebaseUser.getIdToken();

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
  if (isTauri) {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      }
    );
    const restData = await response.json();
    if (restData.error) throw new Error(restData.error.message);

    const cred = await signInWithEmailAndPassword(auth, email, password);
    const u    = cred.user;
    const { data } = await getFirestoreUser(u.uid);

    return {
      uid:         u.uid,
      email:       u.email,
      username:    data.username || null,
      usernameSet: !!data.usernameSet,
      displayName: data.displayName || "",
    };
  }

  const cred = await signInWithEmailAndPassword(auth, email, password);
  const u    = cred.user;
  const { data } = await getFirestoreUser(u.uid);

  return {
    uid:         u.uid,
    email:       u.email,
    username:    data.username || null,
    usernameSet: !!data.usernameSet,
    displayName: data.displayName || "",
  };
};

// ── Email + Password Signup ──────────────────────────────────────────────────
// NOTE: no username param anymore — that's handled by ProfileSetupModal
// after signup completes.
export const signupWithEmail = async (email, password) => {
  if (isTauri) {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      }
    );
    const restData = await response.json();
    if (restData.error) throw new Error(restData.error.message);

    const cred = await signInWithEmailAndPassword(auth, email, password);
    const u    = cred.user;
    const profile = await ensureUserProfile(u);
    return { uid: u.uid, email: u.email, ...profile };
  }

  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const u    = cred.user;
  const profile = await ensureUserProfile(u);
  return { uid: u.uid, email: u.email, ...profile };
};

// ── Google Login (web only) ───────────────────────────────────────────────────
export const loginWithGoogle = async () => {
  const result = await signInWithPopup(auth, googleProvider);
  const u      = result.user;
  const profile = await ensureUserProfile(u);
  return { uid: u.uid, email: u.email, ...profile };
};

// ── Google Login via deep link token (Tauri only) ─────────────────────────────
export const loginWithDeepLinkToken = async (idToken, googleToken, uid, email, displayName) => {
  // Exchange Google idToken for Firebase session via REST (bypasses origin/domain issues)
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${FIREBASE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestUri: "http://localhost",
        postBody: `id_token=${idToken}&providerId=google.com`,
        returnSecureToken: true,
      }),
    }
  );
  const restData = await response.json();
  if (restData.error) throw new Error(restData.error.message);

  // Now sign into Firebase SDK using the fresh idToken from REST response
  const { GoogleAuthProvider, signInWithCredential } = await import("firebase/auth");
  const credential = GoogleAuthProvider.credential(restData.idToken);
  await signInWithCredential(auth, credential);

  // onAuthStateChanged will fire automatically after this — just return profile
  const ref  = doc(db, "users", uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      uid,
      email,
      displayName:           displayName || "",
      username:              null,
      usernameSet:           false,
      friends:               [],
      pendingFriendRequests: [],
      sentFriendRequests:    [],
      online:                true,
      lastSeen:              serverTimestamp(),
      createdAt:             serverTimestamp(),
    });
    return { uid, email, username: null, usernameSet: false, displayName: displayName || "" };
  } else {
    const data = snap.data();
    await updateDoc(ref, { online: true, lastSeen: serverTimestamp() });
    return {
      uid,
      email,
      username:    data.username || null,
      usernameSet: !!data.usernameSet,
      displayName: data.displayName || displayName || "",
    };
  }
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