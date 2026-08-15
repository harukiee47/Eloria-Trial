import cron from "node-cron";
import { db } from "../config/firebaseAdmin.js";
import { sendReminderEmail, sendExpiredEmail } from "./emailService.js";

const REMINDER_WINDOW_DAYS = 3;

export async function runSubscriptionCheck() {
  const now = new Date();
  const reminderCutoff = new Date(now.getTime() + REMINDER_WINDOW_DAYS * 86400000);

  const snapshot = await db.collection("users").where("plan", "==", "pro").get();

  let expiredCount = 0;
  let reminderCount = 0;

  for (const doc of snapshot.docs) {
    const user = doc.data();
    const subscription = user.subscription || {};
    const endsAt = subscription.endsAt ? new Date(subscription.endsAt) : null;

    if (!endsAt) {
      console.warn(`User ${doc.id} is pro with no endsAt date — skipping, needs manual review.`);
      continue;
    }

    if (endsAt <= now) {
      await doc.ref.set({ plan: "free" }, { merge: true });
      if (user.email) await sendExpiredEmail(user.email);
      expiredCount++;
    } else if (endsAt <= reminderCutoff && !subscription.reminderSent) {
      if (user.email) await sendReminderEmail(user.email, endsAt);
      await doc.ref.set({ subscription: { ...subscription, reminderSent: true } }, { merge: true });
      reminderCount++;
    }
  }

  console.log(`Subscription check done: ${expiredCount} expired, ${reminderCount} reminders sent.`);
}

export function startSubscriptionCron() {
  cron.schedule("0 6 * * *", () => {
    runSubscriptionCheck().catch((err) => console.error("Subscription cron failed:", err));
  });
  console.log("Subscription cron scheduled (daily at 6:00 AM).");
}