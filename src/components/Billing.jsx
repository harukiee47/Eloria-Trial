import React, { useEffect, useState } from "react";
import { auth } from "../services/firebase";
import logo from "../assets/logo.png";

const API_BASE = "https://eloria-trial.onrender.com";

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f5f0ea",
    fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    padding: "32px 20px 60px",
  },
  container: {
    maxWidth: 560,
    margin: "0 auto",
  },
  topBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 28,
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
    padding: "6px 2px",
    fontFamily: "inherit",
  },
  brandRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  brandLogo: {
    width: 20, height: 20, borderRadius: 5, objectFit: "cover",
  },
  brandName: {
    fontSize: 12.5,
    fontWeight: 600,
    color: "#7a8a84",
    letterSpacing: "0.01em",
  },
  pageHeading: {
    fontSize: 26,
    fontWeight: 700,
    color: "#0d3a35",
    letterSpacing: "-0.02em",
    margin: "0 0 6px",
  },
  pageSub: {
    fontSize: 14,
    color: "#7a8a84",
    margin: "0 0 28px",
    lineHeight: 1.5,
  },
  card: {
    background: "#fdfaf6",
    border: "1px solid #e4ddd5",
    borderRadius: 18,
    overflow: "hidden",
    boxShadow: "0 2px 20px rgba(13,58,53,0.06)",
    marginBottom: 20,
  },
  cardHeader: {
    padding: "22px 26px",
    borderBottom: "1px solid #ede8e1",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardHeaderLeft: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  planIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: "#0d3a35",
    margin: 0,
  },
  cardSubtitle: {
    fontSize: 12.5,
    color: "#9aa8a2",
    marginTop: 2,
  },
  cardBody: {
    padding: "20px 26px 26px",
  },
  row: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "13px 0",
    borderBottom: "1px solid #ede8e1",
  },
  rowLast: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "13px 0 0",
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
  infoBox: {
    marginTop: 20,
    padding: "14px 16px",
    background: "#f5f2ed",
    borderRadius: 12,
    fontSize: 13,
    color: "#3a5a55",
    lineHeight: 1.6,
    display: "flex",
    gap: 10,
    alignItems: "flex-start",
  },
  successBox: {
    marginTop: 20,
    padding: "14px 16px",
    background: "rgba(39,97,82,0.08)",
    border: "1px solid rgba(39,97,82,.2)",
    borderRadius: 12,
    fontSize: 13,
    color: "#276152",
    lineHeight: 1.6,
    display: "flex",
    gap: 10,
    alignItems: "flex-start",
  },
  cancelBtn: {
    marginTop: 20,
    width: "100%",
    padding: "12px",
    background: "none",
    border: "1.5px solid #e0a0a0",
    borderRadius: 12,
    color: "#c04040",
    fontSize: 13.5,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "background .12s",
  },
  upgradeBtn: {
    marginTop: 4,
    width: "100%",
    padding: "13px",
    background: "linear-gradient(135deg, #0d3a35, #1a5a52)",
    border: "none",
    borderRadius: 12,
    color: "#fff",
    fontSize: 13.5,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  featureList: {
    listStyle: "none",
    margin: "0 0 20px",
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  featureItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 13.5,
    color: "#3a5a55",
  },
  errorText: {
    color: "#c04040",
    fontSize: 13,
    background: "#fdf0f0",
    border: "1px solid #f5cece",
    borderRadius: 12,
    padding: "12px 14px",
    marginTop: 16,
    lineHeight: 1.5,
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
  helpText: {
    fontSize: 12.5,
    color: "#9aa8a2",
    textAlign: "center",
    marginTop: 4,
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

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#276152" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const InfoIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3a5a55" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#276152" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const CrownIcon = ({ color = "#276152" }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 18h20l-2-9-5 4-3-7-3 7-5-4-2 9z" />
  </svg>
);

export default function Billing({ onBack }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState(null);
  const [cancelSuccess, setCancelSuccess] = useState(false);

  const fetchStatus = async () => {
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch(`${API_BASE}/api/membership/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Could not load membership status.");
      setStatus(data);
    } catch (err) {
      setError(err.message || "Could not load membership status.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStatus(); }, []);

  const handleCancel = async () => {
    if (!window.confirm("Turn off auto-renew? You'll keep Pro access until your current period ends, then your account moves to the Free plan.")) return;
    setCancelling(true);
    setError(null);
    setCancelSuccess(false);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch(`${API_BASE}/api/payments/cancel`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to cancel subscription.");
      setCancelSuccess(true);
      await fetchStatus();
    } catch (err) {
      setError(err.message || "Failed to cancel subscription. Please try again.");
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
              ← Back to chat
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
        <div style={styles.topBar}>
          {onBack ? (
            <button style={styles.backBtn} onClick={onBack}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Back to chat
            </button>
          ) : <span />}
          <div style={styles.brandRow}>
            <img src={logo} alt="Eloria" style={styles.brandLogo} />
            <span style={styles.brandName}>Eloria AI</span>
          </div>
        </div>

        <h1 style={styles.pageHeading}>Billing & subscription</h1>
        <p style={styles.pageSub}>Manage your Eloria plan, renewal date, and auto-renew settings.</p>

        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <div style={styles.cardHeaderLeft}>
              <div style={{
                ...styles.planIconWrap,
                background: isPro ? "rgba(39,97,82,0.12)" : "rgba(193,127,42,.1)",
              }}>
                <CrownIcon color={isPro ? "#276152" : "#c17f2a"} />
              </div>
              <div>
                <h2 style={styles.cardTitle}>
                  {status.plan === "admin" ? "Admin" : isPro ? "Eloria Pro" : "Free plan"}
                </h2>
                <div style={styles.cardSubtitle}>
                  {isPro ? "Full access to Eloria" : "Limited access — upgrade anytime"}
                </div>
              </div>
            </div>
          </div>

          <div style={styles.cardBody}>
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

                {cancelSuccess && (
                  <div style={styles.successBox}>
                    <CheckCircleIcon />
                    <span>Auto-renew turned off. You'll keep Pro access until the date above.</span>
                  </div>
                )}

                {sub?.cancelled ? (
                  !cancelSuccess && (
                    <div style={styles.infoBox}>
                      <InfoIcon />
                      <span>Auto-renew is off. You'll keep Pro access until the date above, then your account moves to the Free plan.</span>
                    </div>
                  )
                ) : (
                  <>
                    <button
                      style={{ ...styles.cancelBtn, opacity: cancelling ? 0.6 : 1 }}
                      onClick={handleCancel}
                      disabled={cancelling}
                    >
                      {cancelling ? "Cancelling…" : "Turn off auto-renew"}
                    </button>
                    <div style={styles.helpText}>You'll keep access until your period ends — this doesn't cancel immediately.</div>
                  </>
                )}
              </>
            )}

            {status.plan === "admin" && (
              <div style={styles.infoBox}>
                <InfoIcon />
                <span>Admin accounts have unrestricted access and aren't billed.</span>
              </div>
            )}

            {!isPro && (
              <>
                <ul style={styles.featureList}>
                  <li style={styles.featureItem}><CheckIcon /> Higher daily message limits</li>
                  <li style={styles.featureItem}><CheckIcon /> Eloria Code access</li>
                  <li style={styles.featureItem}><CheckIcon /> Group chats</li>
                  <li style={styles.featureItem}><CheckIcon /> Priority response speed</li>
                </ul>
                <button style={styles.upgradeBtn} onClick={onBack}>
                  Upgrade to Pro
                </button>
              </>
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