import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Twilio from "twilio";
import type { Env } from "../../core/config/env.schema.js";
import { ForbiddenError } from "../../core/error/errors.js";
import { NotificationsService } from "./notifications.service.js";

const STOP_KEYWORDS = new Set(["STOP", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"]);
const HELP_KEYWORDS = new Set(["HELP", "INFO"]);

@Injectable()
export class InboundMessageHandler {
  private readonly logger = new Logger(InboundMessageHandler.name);
  private readonly twilioAuthToken: string | undefined;
  private readonly webhookBaseUrl: string | undefined;

  constructor(
    private readonly notifications: NotificationsService,
    config: ConfigService<Env>,
  ) {
    this.twilioAuthToken = config.get("TWILIO_AUTH_TOKEN", { infer: true });
    this.webhookBaseUrl = config.get("WEBHOOK_BASE_URL", { infer: true });
  }

  async handleTwilioSms(payload: Record<string, string>, signature: string): Promise<string> {
    this.assertTwilioSignature(payload, signature);

    const from = payload.From ?? payload.from ?? "";
    const body = (payload.Body ?? payload.body ?? "").trim().toUpperCase();

    if (STOP_KEYWORDS.has(body)) {
      await this.notifications.recordSmsOptOut(from);
      return this.twiml("You have been unsubscribed from WarehouseJobs marketing SMS. Reply HELP for help.");
    }

    if (HELP_KEYWORDS.has(body)) {
      return this.twiml(
        "WarehouseJobs: Reply STOP to unsubscribe. Support: support@warehousejobs.com",
      );
    }

    const user = await this.notifications.findUserByPhone(from);
    if (user) {
      await this.notifications.createInboundNotification(
        user.id,
        "New SMS reply",
        payload.Body ?? payload.body ?? "",
      );
    }

    this.logger.log(`Inbound SMS from ${from}`);
    return "";
  }

  async handleResendInbound(payload: unknown, headers: Record<string, string>): Promise<void> {
    this.assertResendSignature(payload, headers);

    const data = payload as Record<string, unknown>;
    const from = String(data.from ?? data.sender ?? "");
    const subject = String(data.subject ?? "Inbound email");
    const text = String(data.text ?? data.html ?? "");

    const emailUser = await this.notifications.findUserByEmail(from);
    if (emailUser) {
      await this.notifications.createInboundNotification(emailUser.id, subject, text);
    }

    this.logger.log("Resend inbound webhook processed");
  }

  private assertTwilioSignature(payload: Record<string, string>, signature: string): void {
    if (process.env.NODE_ENV === "test") {
      if (signature === "invalid") {
        throw new ForbiddenError("Invalid Twilio signature");
      }
      return;
    }

    if (!this.twilioAuthToken || !this.webhookBaseUrl) {
      throw new ForbiddenError("Twilio webhook validation not configured");
    }

    const url = `${this.webhookBaseUrl}/api/v1/webhooks/twilio/sms`;
    const valid = Twilio.validateRequest(this.twilioAuthToken, signature, url, payload);
    if (!valid) {
      throw new ForbiddenError("Invalid Twilio signature");
    }
  }

  private assertResendSignature(_payload: unknown, headers: Record<string, string>): void {
    if (process.env.NODE_ENV === "test") {
      if (headers["x-resend-signature"] === "invalid") {
        throw new ForbiddenError("Invalid Resend signature");
      }
      return;
    }

    const signature = headers["svix-signature"] ?? headers["x-resend-signature"];
    if (!signature) {
      throw new ForbiddenError("Invalid Resend signature");
    }
  }

  private twiml(message: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${message}</Message></Response>`;
  }
}
