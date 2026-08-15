import React, { useEffect, useState } from "react";
import { auth } from "../services/firebase";

const API_BASE = "https://eloria-trial.onrender.com";

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f5f0ea",
    fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    padding: "40px 20px",
  },
  container: {
    maxWidth: 520,
    margin: "0 auto",
  },
  backBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    background: "none",
    border: "none",
    color: "#3a5a55",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    padding: "6px 0",
    marginBottom: 20,
    fontFamily: "inherit",
  },
  card: {
    background: "#fdfaf6",
    border: "1px solid #e4ddd5",
    borderRadius: 16,
    overflow: "hidden",
    boxShadow: "0 2px 16px rgba(13,58,53,0.06)",
  },
  cardHeader: {
    padding: "28px 28px 24px",
    borderBottom: "1px solid #ede8e1",
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
    color: "#0d3a35",
    letterSpacing: "-0.02em",
    margin: 0,
  },
  subtitle: {
    fontSize: 13,
    color: "#7a8a84",
    marginTop: 4,
  },
  cardBody: {
    padding: "24px 28px 28px",
  },
  row: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 0",
    borderBottom: "1px solid #ede8e1",
  },
  rowLast: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 0 0",
  },
  label: {
    fontSize: 13,
    color: "#7a8a84",
  },
  value: {
    fontSize: 13.5,
    color: "#0d3a35",
    fontWeight: 600,
  },
  planBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "4px 12px",
    borderRadius: 20,
    fontSize: 11.5,
    fontWeight: 700,
    letterSpacing: "0.02em",
  },
  proBadge: {
    background: "rgba(39,97,82,0.12)",
    color: "#276152",
    border: "1px solid rgba(39,97,82,.25)",
  },
  freeBadge: {
    background: "rgba(193,127,42,.1)",
    color: "#c17f2a",
    border: "1px solid rgba(193,127,42,.25)",
  },
  infoBox: {
    marginTop: 20,
    padding: "14px 16px",
    background: "#f5f2ed",
    borderRadius: 12,
    fontSize: 13,
    color: "#3a5a55",
    lineHeight: 1.6,
  },
  cancelBtn: {
    marginTop: 20,
    width: "100%",
    padding: "12px",
    background: "none",
    border: "1.5px solid #e0a0a0",
    borderRadius: 10,
    color: "#c04040",
    fontSize: 13.5,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "background .12s",
  },
  upgradeBtn: {
    marginTop: 20,
    width: "100%",
    padding: "12px",
    background: "linear-gradient(135deg, #0d3a35, #1a5a52)",
    border: "none",
    borderRadius: 10,
    color: "#fff",
    fontSize: 13.5,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  errorText: {
    color: "#c04040",
    fontSize: 13,
    background: "#fdf0f0",
    border: "1px solid #f5cece",
    borderRadius: 10,
    padding: "12px 14px",
    marginTop: 16,
  },
  loadingWrap: {
    minHeight: "100vh",
    background: "#f5f0ea",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'DM Sans', sans-serif",
    color: "#7a8a84",
    fontSize: 14,
  },
  devBox: {
    marginTop: 28,
    padding: "12px 14px",
    background: "#fff8ea",
    border: "1px dashed #d9b968",
    borderRadius: 10,
  },
  devLabel: {
    fontSize: 10.5,
    fontWeight: 700,
    color: "#9a7a1f",
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  devBtn: {
    padding: "8px 14px",
    background: "#fff",
    border: "1px solid #d9b968",
    borderRadius: 8,
    color: "#7a5f16",
    fontSize: 12.5,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
  },
};

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

  // ── TEMPORARY DEV TOOL — remove this whole function + the box that uses it
  // once you're done testing the reminder/expiry email flow. See instructions
  // below the component.
  const runDevCheck = async () => {
    const token = await auth.currentUser.getIdToken();
    const res = await fetch(`${API_BASE}/api/membership/dev/run-check`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    alert(JSON.stringify(data));
  };

  if (loading) return <div style={styles.loadingWrap}>Loading membership details…</div>;

  if (error && !status) {
    return (
      <div style={styles.page}>
        <div style={styles.container}>
          {onBack && (
            <button style={styles.backBtn} onClick={onBack}>
              ← Back
            </button>
          )}
          <div style={styles.errorText}>{error}</div>
        </div>
      </div>
    );
  }

  if (!status) return null;

  const isPro = status.plan === "pro" || status.plan === "admin";
  const sub = status.subscription;
  const endsAt = sub?.endsAt || sub?.renewsAt;
  const daysLeft = endsAt ? Math.max(0, Math.ceil((new Date(endsAt) - new Date()) / 86400000)) : null;

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        {onBack && (
          <button style={styles.backBtn} onClick={onBack}>
            ← Back
          </button>
        )}

        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h2 style={styles.title}>Membership</h2>
            <div style={styles.subtitle}>Manage your Eloria subscription and billing</div>
          </div>

          <div style={styles.cardBody}>
            <div style={styles.row}>
              <span style={styles.label}>Current plan</span>
              <span style={{ ...styles.planBadge, ...(isPro ? styles.proBadge : styles.freeBadge) }}>
                {status.plan === "admin" ? "Admin" : isPro ? "Pro ✦" : "Free"}
              </span>
            </div>

            {isPro && endsAt && (
              <>
                <div style={styles.row}>
                  <span style={styles.label}>
                    {sub?.cancelled ? "Access ends" : "Renews on"}
                  </span>
                  <span style={styles.value}>
                    {new Date(endsAt).toLocaleDateString("en-US", {
                      month: "long", day: "numeric", year: "numeric",
                    })}
                  </span>
                </div>
                <div style={styles.rowLast}>
                  <span style={styles.label}>Time remaining</span>
                  <span style={styles.value}>
                    {daysLeft} day{daysLeft === 1 ? "" : "s"}
                  </span>
                </div>

                {sub?.cancelled ? (
                  <div style={styles.infoBox}>
                    Auto-renew is off. You'll keep Pro access until the date above, then your account moves to the Free plan.
                  </div>
                ) : (
                  <button
                    style={{ ...styles.cancelBtn, opacity: cancelling ? 0.6 : 1 }}
                    onClick={handleCancel}
                    disabled={cancelling}
                  >
                    {cancelling ? "Cancelling…" : "Cancel subscription"}
                  </button>
                )}
              </>
            )}

            {!isPro && (
              <div style={styles.infoBox}>
                You're currently on the Free plan. Upgrade anytime to unlock higher limits, Eloria Code, and Groups.
              </div>
            )}

            {error && <div style={styles.errorText}>{error}</div>}
          </div>
        </div>

        {/* ── TEMPORARY — remove after testing, see note below ── */}
        <div style={styles.devBox}>
          <div style={styles.devLabel}>Dev testing only</div>
          <button style={styles.devBtn} onClick={runDevCheck}>
            Run subscription check
          </button>
        </div>
      </div>
    </div>
  );
}