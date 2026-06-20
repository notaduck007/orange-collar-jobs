import type { ConfigService } from "@nestjs/config";
import type { Env } from "./env.schema.js";

const PLACEHOLDER_PATTERNS = ["xxxx", "placeholder", "xxxxxxxx", "change_me", "your-"];

/** Whether Resend should be called (production, explicit dev flag, or real API key in dev). */
export function shouldSendExternalEmail(config: ConfigService<Env>): boolean {
  const nodeEnv = config.get("NODE_ENV", { infer: true });
  if (nodeEnv === "test") return false;
  if (nodeEnv === "production") return true;
  if (config.get("EMAIL_SEND_IN_DEV", { infer: true })) return true;

  const apiKey = config.get("EMAIL_API_KEY", { infer: true }) ?? "";
  if (!apiKey.startsWith("re_") || apiKey.length < 24) return false;
  const lower = apiKey.toLowerCase();
  return !PLACEHOLDER_PATTERNS.some((p) => lower.includes(p));
}

/** Twilio Account SID + Auth Token present (OAuth app creds are not used for REST API). */
export function isTwilioConfigured(config: ConfigService<Env>): boolean {
  const sid = config.get("TWILIO_ACCOUNT_SID", { infer: true });
  const token = config.get("TWILIO_AUTH_TOKEN", { infer: true });
  return Boolean(sid?.startsWith("AC") && token && token.length > 8);
}
