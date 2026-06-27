import { useState, useEffect } from "react";
import { auth } from "../services/firebase";
import "./Pricing.css";

export default function Pricing({ onBack }) {
  const isTauri = Boolean(window.__TAURI__);

  useEffect(() => {
    if (auth.currentUser) {
      auth.currentUser.getIdToken().then(token => console.log("TOKEN:", token));
    }
  }, []);

  const [status, setStatus] = useState("");
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleUpgrade() {
    setStatus("");
    setIsError(false);

    const user = auth.currentUser;

    if (!user) {
      setStatus("Please sign in before upgrading.");
      setIsError(true);
      return;
    }

    setLoading(true);

    try {
      const idToken = await user.getIdToken();

      const res = await fetch("https://eloria-trial.onrender.com/api/payments/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ plan: "pro_monthly" }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Checkout failed.");
      }

      if (isTauri) {
        // Open checkout in system browser on desktop
        const { open } = await import("@tauri-apps/plugin-shell");
        await open(data.url);
        setStatus("Checkout opened in your browser. Come back after payment.");
        setIsError(false);
      } else {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error(err);
      setStatus(err.message || "Something went wrong. Please try again.");
      setIsError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ec-pricing-page">
      {onBack && (
        <button onClick={onBack} style={{ margin: "16px 24px", background: "none", border: "none", cursor: "pointer", color: "var(--ec-ink)", fontSize: 14 }}>
          ← Back
        </button>
      )}
      <header className="ec-pricing-header">
        <span className="ec-eyebrow ec-display">Eloria Plans</span>
        <h1 className="ec-display">Pick how far you want to go</h1>
        <p className="ec-subtitle">
          Start free with everyday chat. Upgrade to Pro for higher daily
          limits and access to Eloria Code — a specialist mode tuned for
          building software.
        </p>
      </header>

      <main className="ec-pricing-main">
        <div className="ec-plans">
          {/* Free Plan */}
          <div className="ec-card ec-card-free">
            <div className="ec-plan-name ec-display">Free</div>
            <div className="ec-price">
              <span className="ec-amount ec-display">$0</span>
              <span className="ec-period">/ forever</span>
            </div>
            <div className="ec-plan-tagline">
              For everyday questions and casual use.
            </div>
            <ul className="ec-features">
              <li><span className="ec-check">✓</span> 50 chat messages per day</li>
              <li><span className="ec-check">✓</span> 4 image generations per day</li>
              <li><span className="ec-check">✓</span> Standard response speed</li>
              <li className="ec-locked"><span className="ec-check">—</span> Eloria Code access</li>
              <li className="ec-locked"><span className="ec-check">—</span> Priority limits</li>
            </ul>
            <button className="ec-cta" disabled>
              Your current plan
            </button>
          </div>

          {/* Pro Plan */}
          <div className="ec-card ec-card-pro">
            <div className="ec-plan-name ec-display">Pro</div>
            <div className="ec-price">
              <span className="ec-amount ec-display">$11.99</span>
              <span className="ec-period">/ month</span>
            </div>
            <div className="ec-plan-tagline">
              For builders who need more room and Eloria Code.
            </div>
            <ul className="ec-features">
              <li><span className="ec-check">✓</span> 100 chat messages per day</li>
              <li><span className="ec-check">✓</span> 25 Eloria Code requests per day</li>
              <li><span className="ec-check">✓</span> 12 image generations per day</li>
              <li><span className="ec-check">✓</span> Full access to Eloria Code, tuned for software development</li>
              <li><span className="ec-check">✓</span> Priority over free-tier usage</li>
            </ul>
            <button
              className="ec-cta ec-cta-pro"
              onClick={handleUpgrade}
              disabled={loading}
            >
              {loading ? "Redirecting…" : "Upgrade to Pro"}
            </button>
          </div>
        </div>

        {status && (
          <div className={`ec-status ${isError ? "ec-status-error" : ""}`}>
            {status}
          </div>
        )}
      </main>

      <footer className="ec-pricing-footer">
        Already Pro? Manage your subscription from the link in your purchase email.
        <br />
        Questions — <button onClick={() => {}} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>contact support</button>
      </footer>
    </div>
  );
}