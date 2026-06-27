import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDmfVTBxzZgqdshD6ld91XSTImZ-LsS39A",
  authDomain: "localhost",
  projectId: "speed-eb68b",
  storageBucket: "speed-eb68b.firebasestorage.app",
  messagingSenderId: "253379248208",
  appId: "1:253379248208:web:f19f6e6248fa3705411155"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);