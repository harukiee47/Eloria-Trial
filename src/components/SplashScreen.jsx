import { useEffect, useState } from "react";
import logo from "../assets/logo.png";
import "./SplashScreen.css";

export default function SplashScreen({ onFinish }) {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // start fade BEFORE switching screen
    const fadeTimer = setTimeout(() => {
      setFadeOut(true);
    }, 2200); // start fade

    const finishTimer = setTimeout(() => {
      onFinish();
    }, 2800); // full exit

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(finishTimer);
    };
  }, []);

  return (
    <div className={`splash-root ${fadeOut ? "fade-out" : ""}`}>
      <div className="splash-glow" />

      <img src={logo} className="splash-logo" alt="Eloria" />

      <div className="splash-text">Initializing Eloria...</div>
    </div>
  );
}