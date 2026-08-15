import React, { useEffect, useState } from "react";
import { auth } from "../services/firebase";
import logo from "../assets/logo.png";

const API_BASE = "https://eloria-trial.onrender.com";

const animationCss = `
  .bl-back-btn, .bl-cancel-btn, .bl-upgrade-btn, .bl-modal-keep-btn,
  .bl-modal-confirm-btn, .bl-reason-row {
    transition: transform .14s ease, box-shadow .14s ease, background .14s ease, opacity .14s ease, border-color .14s ease;
  }
  .bl-back-btn:hover { transform: translateX(-2px); opacity: 0.75; }
  .bl-back-btn:active { transform: translateX(-2px) scale(0.96); }

  .bl-cancel-btn:hover:not(:disabled) { background: #fdf0f0; border-color: #d97d7d; }
  .bl-cancel-btn:active:not(:disabled) { transform: scale(0.97); }

  .bl-upgrade-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(13,58,53,0.28); }
  .bl-upgrade-btn:active { transform: translateY(0) scale(0.98); box-shadow: 0 4px 10px rgba(13,58,53,0.2); }

  .bl-modal-keep-btn:hover:not(:disabled) { background: #f5f2ed; border-color: #c7bdae; }
  .bl-modal-keep-btn:active:not(:disabled) { transform: scale(0.97); }

  .bl-modal-confirm-btn:hover:not(:disabled) { background: #a83535; transform: translateY(-1px); box-shadow: 0 6px 16px rgba(192,64,64,0.3); }
  .bl-modal-confirm-btn:active:not(:disabled) { transform: translateY(0) scale(0.97); box-shadow: none; }

  .bl-reason-row:hover { background: #f5f2ed; }

  @keyframes bl-modal-in {
    from { opacity: 0; transform: translateY(10px) scale(0.98); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes bl-overlay-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes bl-fade-in {
    from { opacity: 0; transform: translateY(-4px); }
    to   { opacity: 1; transform: translateY(0); }
  }
`;

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
    animation: "bl-fade-in .25s ease",
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
    animation: "bl-fade-in .25s ease",
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
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(13,58,53,0.35)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    zIndex: 1000,
    animation: "bl-overlay-in .16s ease",
  },
  modalCard: {
    width: "100%",
    maxWidth: 440,
    background: "#fdfaf6",
    borderRadius: 18,
    border: "1px solid #e4ddd5",
    boxShadow: "0 12px 40px rgba(13,58,53,0.22)",
    padding: "26px 26px 22px",
    fontFamily: "'DM Sans', sans-serif",
    animation: "bl-modal-in .2s cubic-bezier(0.16, 1, 0.3, 1)",
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: 700,
    color: "#0d3a35",
    margin: "0 0 6px",
  },
  modalSub: {
    fontSize: 13,
    color: "#7a8a84",
    lineHeight: 1.5,
    margin: "0 0 18px",
  },
  reasonList: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    marginBottom: 14,
  },
  reasonRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 6px",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 13.5,
    color: "#3a5a55",
  },
  checkbox: {
    width: 16,
    height: 16,
    accentColor: "#276152",
    cursor: "pointer",
    flexShrink: 0,
  },
  textarea: {
    width: "100%",
    minHeight: 64,
    marginTop: 4,
    marginBottom: 18,
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #e4ddd5",
    fontFamily: "inherit",
    fontSize: 13,
    color: "#0d3a35",
    resize: "vertical",
    boxSizing: "border-box",
    background: "#fff",
  },
  modalBtnRow: {
    display: "flex",
    gap: 10,
  },
  modalKeepBtn: {
    flex: 1,
    padding: "11px",
    borderRadius: 10,
    border: "1.5px solid #d8d0c6",
    background: "none",
    color: "#3a5a55",
    fontSize: 13.5,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  modalConfirmBtn: {
    flex: 1,
    padding: "11px",
    borderRadius: 10,
    border: "none",
    background: "#c04040",
    color: "#fff",
    fontSize: 13.5,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
  },
};

const CANCEL_REASONS = [
  "Too expensive",
  "Not using it enough",
  "Missing a feature I need",
  "Switching to another tool",
  "Ran into bugs or issues",
  "Just trying it out / temporary",
];

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
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelStep, setCancelStep] = useState("confirm"); // "confirm" | "reasons"
  const [selectedReasons, setSelectedReasons] = useState([]);
  const [otherText, setOtherText] = useState("");

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

  const toggleReason = (reason) => {
    setSelectedReasons((prev) =>
      prev.includes(reason) ? prev.filter((r) => r !== reason) : [...prev, reason]
    );
  };

  const closeCancelModal = () => {
    setShowCancelModal(false);
    setCancelStep("confirm");
    setSelectedReasons([]);
    setOtherText("");
  };

  const confirmCancel = async () => {
    setCancelling(true);
    setError(null);
    setCancelSuccess(false);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch(`${API_BASE}/api/payments/cancel`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reasons: selectedReasons, otherText: otherText.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to cancel subscription.");
      setCancelSuccess(true);
      closeCancelModal();
      await fetchStatus();
    } catch (err) {
      setError(err.message || "Failed to cancel subscription. Please try again.");
      closeCancelModal();
    } finally {
      setCancelling(false);
    }
  };


  if (loading) return <div style={styles.loadingWrap}>Loading membership details…</div>;

  if (error && !status) {
    return (
      <div style={styles.page}>
        <style>{animationCss}</style>
        <div style={styles.container}>
          {onBack && (
            <button className="bl-back-btn" style={styles.backBtn} onClick={onBack}>
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
      <style>{animationCss}</style>
      <div style={styles.container}>
        <div style={styles.topBar}>
          {onBack ? (
            <button className="bl-back-btn" style={styles.backBtn} onClick={onBack}>
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
                      className="bl-cancel-btn"
                      style={{ ...styles.cancelBtn, opacity: cancelling ? 0.6 : 1 }}
                      onClick={() => setShowCancelModal(true)}
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
                <button className="bl-upgrade-btn" style={styles.upgradeBtn} onClick={onBack}>
                  Upgrade to Pro
                </button>
              </>
            )}

            {error && <div style={styles.errorText}>{error}</div>}
          </div>
        </div>
      </div>

      {showCancelModal && (
        <div style={styles.modalOverlay} onClick={() => !cancelling && closeCancelModal()}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            {cancelStep === "confirm" ? (
              <>
                <h3 style={styles.modalTitle}>Turn off auto-renew?</h3>
                <p style={styles.modalSub}>
                  You'll keep Pro access until {endsAt ? new Date(endsAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "your period ends"}, then your account moves to Free. This won't cancel your access right away.
                </p>
                <div style={styles.modalBtnRow}>
                  <button
                    className="bl-modal-keep-btn"
                    style={styles.modalKeepBtn}
                    onClick={closeCancelModal}
                  >
                    Keep my subscription
                  </button>
                  <button
                    className="bl-modal-confirm-btn"
                    style={styles.modalConfirmBtn}
                    onClick={() => setCancelStep("reasons")}
                  >
                    Yes, turn it off
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 style={styles.modalTitle}>Mind telling us why?</h3>
                <p style={styles.modalSub}>
                  This helps us improve Eloria. Totally optional.
                </p>

                <div style={styles.reasonList}>
                  {CANCEL_REASONS.map((reason) => (
                    <label key={reason} className="bl-reason-row" style={styles.reasonRow}>
                      <input
                        type="checkbox"
                        style={styles.checkbox}
                        checked={selectedReasons.includes(reason)}
                        onChange={() => toggleReason(reason)}
                      />
                      {reason}
                    </label>
                  ))}
                </div>
                <textarea
                  style={styles.textarea}
                  placeholder="Something else? Tell us more (optional)"
                  value={otherText}
                  onChange={(e) => setOtherText(e.target.value)}
                />

                <div style={styles.modalBtnRow}>
                  <button
                    className="bl-modal-keep-btn"
                    style={styles.modalKeepBtn}
                    onClick={() => setCancelStep("confirm")}
                    disabled={cancelling}
                  >
                    Back
                  </button>
                  <button
                    className="bl-modal-confirm-btn"
                    style={{ ...styles.modalConfirmBtn, opacity: cancelling ? 0.6 : 1 }}
                    onClick={confirmCancel}
                    disabled={cancelling}
                  >
                    {cancelling ? "Cancelling…" : "Confirm cancellation"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}