/**
 * Integration-test overrides — run after jest-setup.ts (which loads root .env).
 *
 * Integration specs use real Postgres/Redis/MinIO but must not call external
 * notification APIs (Resend/Twilio). Force test NODE_ENV and dry-run email so
 * dev .env credentials do not trigger live sends during register/forgot-password flows.
 */
process.env.NODE_ENV = "test";
process.env.EMAIL_SEND_IN_DEV = "false";
process.env.EMAIL_API_KEY = "re_xxxxxxxxxxxxxxxxxxxxxxxxxxxx";

delete process.env.TWILIO_ACCOUNT_SID;
delete process.env.TWILIO_AUTH_TOKEN;
