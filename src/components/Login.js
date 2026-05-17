import React, { useState } from "react"; 
import { loginWithEmail, loginWithGoogle, signupWithEmail } from "../services/auth";
import "./Login.css";
import loginBg from "../assets/login.png"; // background image

export default function Login({ onLogin }) {
  const [username, setUsername] = useState(""); // for signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignup, setIsSignup] = useState(false);
  const [error, setError] = useState("");
  const [animating, setAnimating] = useState(false);

  const handleSubmit = async () => {
    try {
      let user;
      if (isSignup) {
        user = await signupWithEmail(email, password, username); // pass username
      } else {
        user = await loginWithEmail(email, password);
      }
      onLogin(user);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleGoogle = async () => {
    try {
      const user = await loginWithGoogle();
      onLogin(user);
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleSignup = () => {
    setAnimating(true);
    setTimeout(() => {
      setIsSignup(!isSignup);
      setError("");
      setAnimating(false);
    }, 300);
  };

  return (
    <div
      className="login-root"
      style={{ backgroundImage: `url(${loginBg})` }}
    >
      <div className="login-overlay" />

<div className="orb orb-1"></div>
<div className="orb orb-2"></div>
<div className="orb orb-3"></div>
      <div className={`login-card ${animating ? "fade-slide-out" : "fade-slide-in"}`}>
        <div className="login-header">
        <img
  src="/logo.png"
  alt="Eloria"
  className="login-logo"
/>
          <h2>{isSignup ? "Create Account" : "Welcome Back"}</h2>
          <p>{isSignup ? "Sign up to continue" : "Login to your account"}</p>
        </div>
        <div className="login-body">
          {isSignup && (
            <input
              className="animate-input"
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          )}
          <input
            className="animate-input"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="animate-input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button className="submit-btn animate-btn" onClick={handleSubmit}>
            {isSignup ? "Sign Up" : "Login"}
          </button>
          <button className="google-btn animate-btn" onClick={handleGoogle}>
            <img src="/google-icon.png" alt="Google" /> Continue with Google
          </button>
          {error && <p className="error-msg">{error}</p>}
          <p className="toggle-login" onClick={toggleSignup}>
            {isSignup
              ? "Already have an account? Login"
              : "Don't have an account? Sign Up"}
          </p>
        </div>
      </div>
    </div>
  );
}
