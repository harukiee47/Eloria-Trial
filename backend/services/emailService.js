import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.EMAIL_FROM || "Eloria <onboarding@resend.dev>";

export async function sendReminderEmail(email, endsAt) {
  const dateStr = new Date(endsAt).toDateString();
  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "Your Eloria Pro membership is ending soon",
      html: `<div style="font-family: sans-serif; max-width: 480px;">
        <h2>Your Pro plan is ending soon</h2>
        <p>Your Eloria Pro membership will end on <strong>${dateStr}</strong>.</p>
        <p>Renew now to keep uninterrupted access to Pro features.</p>
      </div>`,
    });
    console.log("Resend reminder result:", JSON.stringify(result));
    return result;
  } catch (err) {
    console.error("Resend reminder FAILED:", err?.message || err);
    throw err;
  }
}

export async function sendExpiredEmail(email) {
  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "Your Eloria Pro membership has ended",
      html: `<div style="font-family: sans-serif; max-width: 480px;">
        <h2>Your Pro plan has ended</h2>
        <p>Your Eloria Pro membership has expired and your account is now on the Free plan.</p>
        <p>You can resubscribe anytime from your account settings.</p>
      </div>`,
    });
    console.log("Resend expired result:", JSON.stringify(result));
    return result;
  } catch (err) {
    console.error("Resend expired FAILED:", err?.message || err);
    throw err;
  }
}