#!/usr/bin/env bun
/**
 * Smoke-test Resend email and Twilio SMS using repo-root .env.
 *
 *   bun run notifications:test
 *
 * TWILIO_FROM_NUMBER must be a number from Twilio Console → Phone Numbers
 * (not your personal cell). NOTIFICATION_TEST_PHONE is the recipient for tests.
 */
import Twilio from "../src/api/node_modules/twilio/index.js";

const PLACEHOLDER_PATTERNS = ["xxxx", "placeholder", "xxxxxxxx", "change_me", "your-"];

function shouldSendExternalEmail(): boolean {
  if (process.env.NODE_ENV === "production") return true;
  if (process.env.EMAIL_SEND_IN_DEV === "true") return true;
  const apiKey = process.env.EMAIL_API_KEY ?? "";
  if (!apiKey.startsWith("re_") || apiKey.length < 24) return false;
  const lower = apiKey.toLowerCase();
  return !PLACEHOLDER_PATTERNS.some((p) => lower.includes(p));
}

function isTwilioConfigured(): boolean {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  return Boolean(sid?.startsWith("AC") && token && token.length > 8);
}

function twilioClient(): ReturnType<typeof Twilio> {
  return Twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
}

/** E.164-ish normalize so +1940… and 940… compare equal. */
function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  return digits.startsWith("1") && digits.length === 11 ? `+${digits}` : `+${digits}`;
}

function samePhone(a: string, b: string): boolean {
  return normalizePhone(a) === normalizePhone(b);
}

type TwilioErr = Error & { code?: number; status?: number; moreInfo?: string };

function explainTwilioError(err: TwilioErr, context: string): string {
  const code = err.code;
  const lines = [`  ${context} failed: ${err.message}`];
  if (code === 21659) {
    lines.push(
      "  → TWILIO_FROM_NUMBER must be a Twilio-owned number (Console → Phone Numbers → Manage → Active numbers).",
      "  → Do not use your personal mobile as FROM — copy the +1 number Twilio issued to your account.",
    );
  } else if (code === 21266) {
    lines.push("  → NOTIFICATION_TEST_PHONE must differ from TWILIO_FROM_NUMBER.");
  } else if (code === 21608) {
    lines.push("  → Trial account: verify the recipient number in Twilio Console first.");
  }
  if (err.moreInfo) lines.push(`  → ${err.moreInfo}`);
  return lines.join("\n");
}

async function listOwnedTwilioNumbers(): Promise<string[]> {
  try {
    const client = twilioClient();
    const rows = await client.api.v2010
      .accounts(process.env.TWILIO_ACCOUNT_SID!)
      .incomingPhoneNumbers.list({
        limit: 20,
      });
    return rows.map((n) => n.phoneNumber).filter(Boolean) as string[];
  } catch {
    return [];
  }
}

async function sendEmail(to: string): Promise<void> {
  const fromName = process.env.EMAIL_FROM_NAME ?? "WarehouseJobs";
  const from = process.env.EMAIL_FROM ?? "noreply@warehousejobs.com";
  const apiKey = process.env.EMAIL_API_KEY ?? "";

  if (!shouldSendExternalEmail()) {
    console.log(`[DEV EMAIL] To: ${to} | Subject: WarehouseJobs notification test`);
    console.log("If you received this, Resend is configured correctly.");
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${fromName} <${from}>`,
      to: [to],
      subject: "WarehouseJobs notification test",
      html: "<p>If you received this, Resend is configured correctly.</p>",
      text: "If you received this, Resend is configured correctly.",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend error ${res.status}: ${body}`);
  }
  console.log(`  email sent to ${to}`);
}

async function sendProgrammableSms(to: string, body: string): Promise<boolean> {
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!from) {
    console.log("  skip programmable SMS — TWILIO_FROM_NUMBER not set");
    return true;
  }
  if (samePhone(to, from)) {
    console.log(
      "  skip programmable SMS — NOTIFICATION_TEST_PHONE must differ from TWILIO_FROM_NUMBER",
    );
    return true;
  }

  try {
    await twilioClient().messages.create({ to, from, body });
    console.log(`  programmable SMS sent to ${to} from ${from}`);
    return true;
  } catch (err) {
    console.log(explainTwilioError(err as TwilioErr, "Programmable SMS"));
    const owned = await listOwnedTwilioNumbers();
    if (owned.length > 0) {
      console.log(`  Twilio numbers on this account: ${owned.join(", ")}`);
      console.log("  Set TWILIO_FROM_NUMBER to one of the numbers above.");
    } else {
      console.log("  No Twilio phone numbers found — buy one in Console → Phone Numbers.");
    }
    return false;
  }
}

async function sendVerifyOtp(to: string): Promise<boolean> {
  const verifySid = process.env.TWILIO_VERIFY_SERVICE_SID;
  if (!verifySid) {
    console.log("  skip Verify OTP — TWILIO_VERIFY_SERVICE_SID not set");
    return true;
  }
  try {
    await twilioClient().verify.v2.services(verifySid).verifications.create({ to, channel: "sms" });
    console.log(`  Twilio Verify OTP dispatched to ${to}`);
    return true;
  } catch (err) {
    console.log(explainTwilioError(err as TwilioErr, "Twilio Verify"));
    return false;
  }
}

async function main(): Promise<void> {
  const testEmail = process.env.NOTIFICATION_TEST_EMAIL ?? process.env.EMAIL_FROM;
  const testPhone = process.env.NOTIFICATION_TEST_PHONE;

  console.log("── Email (Resend) ──");
  console.log(`  send externally: ${shouldSendExternalEmail()}`);
  if (!testEmail) {
    console.log("  skip — set NOTIFICATION_TEST_EMAIL or EMAIL_FROM");
  } else {
    await sendEmail(testEmail);
  }

  console.log("── SMS (Twilio) ──");
  console.log(`  configured: ${isTwilioConfigured()}`);
  if (!testPhone) {
    console.log("  skip — set NOTIFICATION_TEST_PHONE (recipient, not TWILIO_FROM_NUMBER)");
  } else if (!isTwilioConfigured()) {
    console.log("  skip — TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN required");
  } else {
    console.log(`  from (programmable SMS): ${process.env.TWILIO_FROM_NUMBER ?? "(not set)"}`);
    console.log(`  to (test recipient): ${testPhone}`);
    const verifyOk = await sendVerifyOtp(testPhone);
    const smsOk = await sendProgrammableSms(
      testPhone,
      "WarehouseJobs: notification test — Twilio programmable SMS is working.",
    );
    if (!verifyOk || !smsOk) {
      console.log("\n  One or more SMS checks failed — see hints above.");
      process.exit(1);
    }
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
