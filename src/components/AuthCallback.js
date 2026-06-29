import { useEffect } from "react";
import { auth, googleProvider } from "../services/firebase";
import { signInWithPopup } from "firebase/auth";

export default function AuthCallback() {
  useEffect(() => {
    async function doGoogleLogin() {
      try {
        const result = await signInWithPopup(auth, googleProvider);
        const idToken = await result.user.getIdToken();
        const uid = result.user.uid;
        const email = encodeURIComponent(result.user.email || "");
        const displayName = encodeURIComponent(result.user.displayName || "");

        // Exchange idToken for a custom token from your secure backend
        const res = await fetch("https://eloria-trial.onrender.com/api/auth/custom-token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to get custom token");

        window.location.href = `eloria://auth?customToken=${encodeURIComponent(data.customToken)}&uid=${uid}&email=${email}&displayName=${displayName}`;
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