import React, { useEffect, useState } from "react";
import { auth } from "../services/firebase";

const API_BASE = "https://eloria-trial.onrender.com";

export default function Billing({ onBack }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState(null);

  const fetchStatus = async () => {
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch(`${API_BASE}/api/membership/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setStatus(data);
    } catch (err) {
      setError("Could not load membership status.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStatus(); }, []);

  const handleCancel = async () => {
    if (!window.confirm("Cancel your subscription? You'll keep access until your current period ends.")) return;
    setCancelling(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch(`${API_BASE}/api/payments/cancel`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed");
      await fetchStatus();
    } catch (err) {
      setError("Failed to cancel subscription. Please try again.");
    } finally {
      setCancelling(false);
    }
  };

  if (loading) return <div style={{ padding: 24 }}>Loading...</div>;
  if (error) return <div style={{ padding: 24 }}>{error}</div>;
  if (!status) return null;

  const sub = status.subscription;
  const endsAt = sub?.endsAt || sub?.renewsAt;
  const daysLeft = endsAt ? Math.max(0, Math.ceil((new Date(endsAt) - new Date()) / 86400000)) : null;

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: 24 }}>
      {onBack && <button onClick={onBack} style={{ marginBottom: 16 }}>← Back</button>}
      <h2>Membership</h2>
      <p>Current plan: <strong>{status.plan === "pro" ? "Pro" : "Free"}</strong></p>

      {status.plan === "pro" && endsAt && (
        <>
          <p>
            {sub.cancelled
              ? `Auto-renew is off. Your Pro access ends on ${new Date(endsAt).toDateString()}.`
              : `${daysLeft} day${daysLeft === 1 ? "" : "s"} remaining until renewal on ${new Date(endsAt).toDateString()}.`}
          </p>
          {!sub.cancelled && (
            <button onClick={handleCancel} disabled={cancelling}>
              {cancelling ? "Cancelling..." : "Cancel subscription"}
            </button>
          )}
        </>
      )}

      {status.plan === "free" && <p>You're currently on the Free plan. Upgrade anytime from Pricing.</p>}
    </div>
  );
}