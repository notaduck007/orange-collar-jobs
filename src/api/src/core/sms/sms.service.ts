import { Injectable, Logger, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Twilio from "twilio";
import type { Env } from "../config/env.schema.js";

@Injectable()
export class SmsService {
  private readonly client: Twilio.Twilio | null = null;
  private readonly from: string | null = null;
  private readonly verifyServiceSid: string | null = null;
  private readonly logger = new Logger(SmsService.name);

  constructor(@Optional() config?: ConfigService<Env>) {
    const accountSid = config?.get("TWILIO_ACCOUNT_SID", { infer: true });
    const authToken = config?.get("TWILIO_AUTH_TOKEN", { infer: true });

    if (accountSid && authToken) {
      this.client = Twilio(accountSid, authToken);
      this.from = config?.get("TWILIO_FROM_NUMBER", { infer: true }) ?? null;
      this.verifyServiceSid = config?.get("TWILIO_VERIFY_SERVICE_SID", { infer: true }) ?? null;
    } else {
      this.logger.warn("Twilio credentials not configured — SMS features disabled");
    }
  }

  // ── Twilio Verify API ────────────────────────────────────────────────────
  async sendVerificationCode(
    to: string,
    channel: "sms" | "whatsapp" | "email" = "sms",
  ): Promise<void> {
    if (!this.client || !this.verifyServiceSid) {
      this.logger.warn("Twilio Verify not configured — skipping OTP");
      return;
    }
    await this.client.verify.v2
      .services(this.verifyServiceSid)
      .verifications.create({ to, channel });
    this.logger.log(`Verification code sent via ${channel} to ${to}`);
  }

  async checkVerificationCode(to: string, code: string): Promise<boolean> {
    if (!this.client || !this.verifyServiceSid) {
      this.logger.warn("Twilio Verify not configured — skipping check");
      return false;
    }
    const result = await this.client.verify.v2
      .services(this.verifyServiceSid)
      .verificationChecks.create({ to, code });
    return result.status === "approved";
  }

  // ── Twilio Lookup API ────────────────────────────────────────────────────
  async isValidMobileNumber(phone: string): Promise<boolean> {
    if (!this.client) return true; // permissive when not configured
    try {
      const lookup = await this.client.lookups.v2.phoneNumbers(phone).fetch({
        fields: "line_type_intelligence",
      });
      const lineType = (lookup.lineTypeIntelligence as { type?: string } | undefined)?.type;
      return lineType === "mobile" || lineType === "nonFixedVoip";
    } catch {
      return false;
    }
  }

  // ── Twilio Programmable SMS ──────────────────────────────────────────────
  async sendTransactional(to: string, body: string): Promise<void> {
    if (!this.client || !this.from) {
      this.logger.warn("Twilio SMS not configured — skipping transactional message");
      return;
    }
    await this.client.messages.create({ to, from: this.from, body });
    this.logger.log(`Transactional SMS sent to ${to}`);
  }

  async sendApplicationUpdate(to: string, jobTitle: string, status: string): Promise<void> {
    if (!this.client || !this.from) return;
    await this.client.messages.create({
      to,
      from: this.from,
      body: `WarehouseJobs: Your application for "${jobTitle}" is now ${status}. View: warehousejobs.com/applications`,
    });
  }

  async sendNewApplicantAlert(to: string, jobTitle: string, applicantName: string): Promise<void> {
    if (!this.client || !this.from) return;
    await this.client.messages.create({
      to,
      from: this.from,
      body: `WarehouseJobs: ${applicantName} applied for your "${jobTitle}" posting. Review: warehousejobs.com/employer/applications`,
    });
  }

  async sendJobAlert(to: string, jobTitle: string, city: string, applyUrl: string): Promise<void> {
    if (!this.client || !this.from) return;
    await this.client.messages.create({
      to,
      from: this.from,
      body: `WarehouseJobs: New job alert — ${jobTitle} in ${city}. Apply in 60s: ${applyUrl}\nReply STOP to unsubscribe.`,
    });
  }
}
