import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.EMAIL_FROM || "Eloria <onboarding@resend.dev>";

function emailShell({ heading, bodyHtml, ctaText, ctaColor }) {
  return `
  <div style="background:#f5f0ea; padding:40px 20px; font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
    <div style="max-width:480px; margin:0 auto; background:#fdfaf6; border-radius:16px; overflow:hidden; border:1px solid #e4ddd5;">

      <div style="background:linear-gradient(135deg, #0d3a35 0%, #1a5a52 100%); padding:32px 32px 28px; text-align:center;">
        <div style="font-size:20px; font-weight:700; color:#ffffff; letter-spacing:-0.02em;">Eloria AI</div>
      </div>

      <div style="padding:32px;">
        <h1 style="margin:0 0 16px; font-size:20px; font-weight:700; color:#0d3a35; letter-spacing:-0.02em;">${heading}</h1>
        <div style="font-size:14px; color:#3a5a55; line-height:1.7;">
          ${bodyHtml}
        </div>

        ${ctaText ? `
        <div style="margin-top:28px;">
          <a href="https://eloria-trial.onrender.com" style="display:inline-block; padding:12px 28px; background:${ctaColor || "#0d3a35"}; color:#ffffff; text-decoration:none; border-radius:10px; font-size:14px; font-weight:600;">
            ${ctaText}
          </a>
        </div>` : ""}
      </div>

      <div style="padding:20px 32px; border-top:1px solid #e4ddd5; text-align:center;">
        <div style="font-size:11px; color:#7a8a84;">You're receiving this because you have an Eloria AI account.</div>
      </div>

    </div>
  </div>`;
}

export async function sendReminderEmail(email, endsAt) {
  const dateStr = new Date(endsAt).toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const html = emailShell({
    heading: "Your Pro membership is ending soon",
    bodyHtml: `
      <p style="margin:0 0 12px;">Hey there,</p>
      <p style="margin:0 0 12px;">Your Eloria Pro membership is set to end on <strong style="color:#0d3a35;">${dateStr}</strong>.</p>
      <p style="margin:0;">Renew now to keep uninterrupted access to Pro features — higher limits, Eloria Code, Groups, and more.</p>
    `,
    ctaText: "Renew my membership",
    ctaColor: "#0d3a35",
  });

  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "Your Eloria Pro membership is ending soon",
      html,
    });
    console.log("Resend reminder result:", JSON.stringify(result));
    return result;
  } catch (err) {
    console.error("Resend reminder FAILED:", err?.message || err);
    throw err;
  }
}

export async function sendCancellationFeedbackEmail({ userEmail, uid, reasons, otherText }) {
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
  if (!ADMIN_EMAIL) {
    console.warn("ADMIN_EMAIL not set — skipping cancellation feedback email.");
    return null;
  }

  const reasonListHtml = reasons?.length
    ? `<ul style="margin:0 0 12px; padding-left:18px;">${reasons.map(r => `<li>${r}</li>`).join("")}</ul>`
    : `<p style="margin:0 0 12px; color:#7a8a84;">No reasons selected.</p>`;

  const html = emailShell({
    heading: "A user turned off auto-renew",
    bodyHtml: `
      <p style="margin:0 0 12px;"><strong style="color:#0d3a35;">${userEmail || "Unknown email"}</strong> (uid: ${uid}) cancelled auto-renew.</p>
      <p style="margin:0 0 8px; font-weight:600; color:#0d3a35;">Reasons given:</p>
      ${reasonListHtml}
      ${otherText ? `<p style="margin:0 0 4px; font-weight:600; color:#0d3a35;">Additional comments:</p><p style="margin:0; white-space:pre-wrap;">${otherText}</p>` : ""}
    `,
  });

  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject: `Cancellation feedback — ${userEmail || uid}`,
      html,
    });
    console.log("Resend cancellation-feedback result:", JSON.stringify(result));
    return result;
  } catch (err) {
    console.error("Resend cancellation-feedback FAILED:", err?.message || err);
    // Don't throw — feedback email failing shouldn't block the cancel itself.
    return null;
  }
}

export async function sendExpiredEmail(email) {
  const html = emailShell({
    heading: "Your Pro membership has ended",
    bodyHtml: `
      <p style="margin:0 0 12px;">Hey there,</p>
      <p style="margin:0 0 12px;">Your Eloria Pro membership has expired and your account is now on the <strong style="color:#0d3a35;">Free plan</strong>.</p>
      <p style="margin:0;">You can resubscribe anytime to get back your higher limits and Pro-only features.</p>
    `,
    ctaText: "Resubscribe to Pro",
    ctaColor: "#c17f2a",
  });

  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "Your Eloria Pro membership has ended",
      html,
    });
    console.log("Resend expired result:", JSON.stringify(result));
    return result;
  } catch (err) {
    console.error("Resend expired FAILED:", err?.message || err);
    throw err;
  }
}