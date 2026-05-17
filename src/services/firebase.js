import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDmfVTBxzZgqdshD6ld91XSTImZ-LsS39A",
  authDomain: "speed-eb68b.firebaseapp.com",
  projectId: "speed-eb68b",
  storageBucket: "speed-eb68b.firebasestorage.app",
  messagingSenderId: "253379248208",
  appId: "1:253379248208:web:f19f6e6248fa3705411155"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
