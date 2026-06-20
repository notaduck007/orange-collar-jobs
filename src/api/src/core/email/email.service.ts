import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Env } from "../config/env.schema.js";
import { shouldSendExternalEmail } from "../config/notification.util.js";

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Thin email adapter — Resend in production (or dev when configured), console log otherwise.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly sendExternally: boolean;
  private readonly fromAddress: string;
  private readonly fromName: string;
  private readonly apiKey: string;

  constructor(config: ConfigService<Env>) {
    this.sendExternally = shouldSendExternalEmail(config);
    this.fromAddress = config.get("EMAIL_FROM", { infer: true }) ?? "noreply@warehousejobs.com";
    this.fromName = config.get("EMAIL_FROM_NAME", { infer: true }) ?? "WarehouseJobs";
    this.apiKey = config.get("EMAIL_API_KEY", { infer: true }) ?? "";
  }

  async send(options: SendEmailOptions): Promise<void> {
    if (!this.sendExternally) {
      this.logger.log(
        `[DEV EMAIL] To: ${options.to} | Subject: ${options.subject}\n${options.text ?? options.html}`,
      );
      return;
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${this.fromName} <${this.fromAddress}>`,
        to: [options.to],
        subject: options.subject,
        html: options.html,
        text: options.text,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      this.logger.error(`Resend error ${res.status}: ${body}`);
      throw new Error(`Email delivery failed (${res.status})`);
    }

    this.logger.log(`Email sent to ${options.to}: ${options.subject}`);
  }

  sendVerificationEmail(to: string, token: string, baseUrl: string): Promise<void> {
    const link = `${baseUrl}/verify-email?token=${token}`;
    return this.send({
      to,
      subject: "Verify your WarehouseJobs email",
      html: `<p>Click the link below to verify your email:</p><p><a href="${link}">${link}</a></p><p>This link expires in 24 hours.</p>`,
      text: `Verify your email: ${link}\n\nThis link expires in 24 hours.`,
    });
  }

  sendPasswordResetEmail(to: string, token: string, baseUrl: string): Promise<void> {
    const link = `${baseUrl}/reset-password?token=${token}`;
    return this.send({
      to,
      subject: "Reset your WarehouseJobs password",
      html: `<p>Click the link below to reset your password:</p><p><a href="${link}">${link}</a></p><p>This link expires in 1 hour.</p>`,
      text: `Reset your password: ${link}\n\nThis link expires in 1 hour.`,
    });
  }

  sendWelcomeEmail(to: string, fullName?: string | null): Promise<void> {
    const name = fullName?.trim() || "there";
    return this.send({
      to,
      subject: "Welcome to WarehouseJobs",
      html: `<p>Hi ${name},</p><p>Your account is ready. Verify your email to start applying for warehouse jobs near you.</p>`,
      text: `Hi ${name}, your WarehouseJobs account is ready. Verify your email to start applying.`,
    });
  }
}
