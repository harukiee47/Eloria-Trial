import { useEffect } from "react";
import { auth, googleProvider } from "../services/firebase";
import { signInWithPopup } from "firebase/auth";

export default function AuthCallback() {
  useEffect(() => {
    async function doGoogleLogin() {
      try {
        const result = await signInWithPopup(auth, googleProvider);
        const token = await result.user.getIdToken();
        const uid = result.user.uid;
        const email = encodeURIComponent(result.user.email || "");
        const displayName = encodeURIComponent(result.user.displayName || "");
        
        // Get the Google OAuth access token too
        const { GoogleAuthProvider } = await import("firebase/auth");
        const credential = GoogleAuthProvider.credentialFromResult(result);
        const googleToken = credential?.accessToken || "";

        window.location.href = `eloria://auth?token=${token}&googleToken=${encodeURIComponent(googleToken)}&uid=${uid}&email=${email}&displayName=${displayName}`;
      } catch (err) {
        window.location.href = `eloria://auth?error=${encodeURIComponent(err.message)}`;
      }
    }
    doGoogleLogin();
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "sans-serif", gap: 12 }}>
      <div style={{ width: 32, height: 32, border: "3px solid #0d6a5e", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <p style={{ color: "#555" }}>Signing you in with Google...</p>
    </div>
  );
}