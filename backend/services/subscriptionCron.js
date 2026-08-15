import cron from "node-cron";
import { getAuth } from "firebase-admin/auth";
import { db } from "../config/firebaseAdmin.js";
import { sendReminderEmail, sendExpiredEmail } from "./emailService.js";

const REMINDER_WINDOW_DAYS = 3;

// Falls back to Firebase Auth if the Firestore doc is missing an email field,
// and repairs the Firestore doc so this doesn't need to happen again.
async function resolveUserEmail(docRef, docId, userData) {
  if (userData.email) return userData.email;

  try {
    const authUser = await getAuth().getUser(docId);
    if (authUser.email) {
      await docRef.set({ email: authUser.email }, { merge: true });
      console.warn(`Backfilled missing email for user ${docId} from Firebase Auth.`);
      return authUser.email;
    }
  } catch (err) {
    console.warn(`Could not resolve email for user ${docId}:`, err.message);
  }

  return null;
}

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

      const email = await resolveUserEmail(doc.ref, doc.id, user);
      if (email) {
        await sendExpiredEmail(email);
      } else {
        console.warn(`User ${doc.id} expired but has no resolvable email — could not send notice.`);
      }

      expiredCount++;
    } else if (endsAt <= reminderCutoff && !subscription.reminderSent) {
      const email = await resolveUserEmail(doc.ref, doc.id, user);
      if (email) {
        await sendReminderEmail(email, endsAt);
      } else {
        console.warn(`User ${doc.id} due for reminder but has no resolvable email — could not send.`);
      }

      await doc.ref.set(
        { subscription: { ...subscription, reminderSent: true } },
        { merge: true }
      );
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