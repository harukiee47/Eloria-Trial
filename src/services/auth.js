// src/services/auth.js
import { auth, googleProvider } from "./firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";

// Listen to auth state changes
export const checkAuth = (setUser) => {
  const unsubscribe = onAuthStateChanged(auth, (user) => {
    if (user) {
      setUser({ uid: user.uid, email: user.email });
    } else {
      setUser(null);
    }
  });
  return unsubscribe; // cleanup function
};

// Email + Password Login
export const loginWithEmail = async (email, password) => {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;
  return { uid: user.uid, email: user.email };
};

// Email + Password Signup
export const signupWithEmail = async (email, password) => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;
  return { uid: user.uid, email: user.email };
};

// Google Login
export const loginWithGoogle = async () => {
  const result = await signInWithPopup(auth, googleProvider);
  const user = result.user;
  return { uid: user.uid, email: user.email };
};

// Logout
export const logout = async () => {
  await signOut(auth);
};
