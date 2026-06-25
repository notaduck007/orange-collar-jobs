-- Phase 4.5 — Notifications domain

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('system', 'application', 'message', 'marketing', 'auth');
CREATE TYPE "NotificationKind" AS ENUM ('auth', 'transactional', 'marketing');
CREATE TYPE "NotificationChannel" AS ENUM ('email', 'sms', 'in_app');
CREATE TYPE "DeliveryStatus" AS ENUM ('pending', 'queued', 'sent', 'delivered', 'failed', 'bounced', 'skipped');
CREATE TYPE "CampaignStatus" AS ENUM ('draft', 'scheduled', 'sending', 'sent', 'cancelled', 'failed');
CREATE TYPE "CampaignChannel" AS ENUM ('email', 'sms');
CREATE TYPE "OtpPurpose" AS ENUM ('verify_contact', 'login_2fa', 'enable_2fa');
CREATE TYPE "OtpChannel" AS ENUM ('email', 'sms');
CREATE TYPE "MfaMethod" AS ENUM ('sms', 'email', 'totp');
CREATE TYPE "ConsentSource" AS ENUM ('register', 'settings', 'campaign');

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "type" "NotificationType" NOT NULL DEFAULT 'system',
    "sender_id" TEXT,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "email_transactional" BOOLEAN NOT NULL DEFAULT true,
    "email_marketing" BOOLEAN NOT NULL DEFAULT false,
    "sms_transactional" BOOLEAN NOT NULL DEFAULT true,
    "sms_marketing" BOOLEAN NOT NULL DEFAULT false,
    "in_app" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notification_campaigns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" "CampaignChannel" NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'draft',
    "segment" JSONB NOT NULL DEFAULT '{}',
    "subject" TEXT,
    "html_body" TEXT,
    "text_body" TEXT,
    "scheduled_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_campaigns_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notification_deliveries" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "channel" "NotificationChannel" NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "template" TEXT NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'pending',
    "provider_id" TEXT,
    "error" TEXT,
    "idempotency_key" TEXT,
    "campaign_id" TEXT,
    "to_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "marketing_consents" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "channel" "CampaignChannel" NOT NULL,
    "source" "ConsentSource" NOT NULL,
    "opted_in_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "marketing_consents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sms_opt_outs" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "opted_out_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'STOP',

    CONSTRAINT "sms_opt_outs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "otp_challenges" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "channel" "OtpChannel" NOT NULL,
    "destination" TEXT NOT NULL,
    "purpose" "OtpPurpose" NOT NULL,
    "code_hash" TEXT,
    "provider_sid" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_challenges_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_mfa" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "method" "MfaMethod" NOT NULL,
    "destination" TEXT,
    "enabled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_mfa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_user_id_key" ON "notification_preferences"("user_id");
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");
CREATE INDEX "notification_deliveries_user_id_idx" ON "notification_deliveries"("user_id");
CREATE INDEX "notification_deliveries_campaign_id_idx" ON "notification_deliveries"("campaign_id");
CREATE INDEX "notification_deliveries_status_idx" ON "notification_deliveries"("status");
CREATE UNIQUE INDEX "notification_deliveries_idempotency_key_key" ON "notification_deliveries"("idempotency_key");
CREATE INDEX "marketing_consents_user_id_channel_idx" ON "marketing_consents"("user_id", "channel");
CREATE UNIQUE INDEX "sms_opt_outs_phone_key" ON "sms_opt_outs"("phone");
CREATE INDEX "notification_campaigns_status_idx" ON "notification_campaigns"("status");
CREATE INDEX "otp_challenges_destination_purpose_idx" ON "otp_challenges"("destination", "purpose");
CREATE INDEX "otp_challenges_user_id_idx" ON "otp_challenges"("user_id");
CREATE UNIQUE INDEX "user_mfa_user_id_key" ON "user_mfa"("user_id");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "notification_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "marketing_consents" ADD CONSTRAINT "marketing_consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_mfa" ADD CONSTRAINT "user_mfa_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
