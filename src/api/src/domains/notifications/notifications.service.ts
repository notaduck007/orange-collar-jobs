import { createHash, randomInt } from "node:crypto";
import { Injectable, Logger, Optional } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bull";
import type { Queue } from "bull";
import { ConfigService } from "@nestjs/config";
import type { Notification } from "../../core/database/prisma-client.js";
import type { Env } from "../../core/config/env.schema.js";
import { PrismaService } from "../../core/database/prisma.service.js";
import { EmailService } from "../../core/email/email.service.js";
import { SmsService } from "../../core/sms/sms.service.js";
import { ForbiddenError, NotFoundError, ValidationError } from "../../core/error/errors.js";
import { QUEUE_NOTIFICATIONS } from "../../core/queue/queue.module.js";
import { NotificationGateway } from "./notification.gateway.js";
import type { InboxQueryDto } from "./dto/inbox-query.dto.js";
import type { UpdateNotificationPreferencesDto } from "./dto/update-preferences.dto.js";
import type {
  NotificationDeliveryResult,
  NotificationPreferencesResponse,
  NotificationResponse,
  PaginatedNotificationsResponse,
  SendNotificationRequest,
} from "./types.js";

const AUTH_TEMPLATES = new Set([
  "auth.welcome",
  "auth.verify_email",
  "auth.password_reset",
  "auth.otp",
]);

const TRANSACTIONAL_TEMPLATES = new Set(["transactional.password_reset_sms"]);

const MARKETING_TEMPLATES = new Set(["marketing.campaign"]);

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly sms: SmsService,
    private readonly config: ConfigService<Env>,
    @InjectQueue(QUEUE_NOTIFICATIONS) private readonly queue: Queue,
    @Optional() private readonly gateway?: NotificationGateway,
  ) {}

  // ── Auth adapter methods (used by AuthService) ───────────────────────────

  sendWelcomeEmail(to: string, fullName?: string | null): Promise<void> {
    return this.send({
      kind: "auth",
      channel: "email",
      template: "auth.welcome",
      to,
      data: { fullName },
    }).then(() => undefined);
  }

  sendVerificationEmail(to: string, token: string, baseUrl: string): Promise<void> {
    return this.send({
      kind: "auth",
      channel: "email",
      template: "auth.verify_email",
      to,
      data: { token, baseUrl },
    }).then(() => undefined);
  }

  sendPasswordResetEmail(to: string, token: string, baseUrl: string): Promise<void> {
    return this.send({
      kind: "auth",
      channel: "email",
      template: "auth.password_reset",
      to,
      data: { token, baseUrl },
    }).then(() => undefined);
  }

  sendPasswordResetSms(phone: string): Promise<void> {
    return this.send({
      kind: "transactional",
      channel: "sms",
      template: "transactional.password_reset_sms",
      to: phone,
    }).then(() => undefined);
  }

  // ── Core send orchestration ──────────────────────────────────────────────

  async send(request: SendNotificationRequest): Promise<NotificationDeliveryResult> {
    this.validateTemplate(request);

    if (request.kind === "marketing") {
      await this.assertMarketingAllowed(request);
    }

    if (request.idempotencyKey) {
      const existing = await this.prisma.notificationDelivery.findUnique({
        where: { idempotencyKey: request.idempotencyKey },
      });
      if (existing) {
        return { deliveryId: existing.id, status: existing.status };
      }
    }

    const delivery = await this.prisma.notificationDelivery.create({
      data: {
        userId: request.userId ?? null,
        channel: request.channel,
        kind: request.kind,
        template: request.template,
        status: "pending",
        idempotencyKey: request.idempotencyKey ?? null,
        campaignId: request.campaignId ?? null,
        toAddress: request.to ?? null,
      },
    });

    if (request.channel === "in_app") {
      if (!request.userId || !request.title || !request.body) {
        throw new ValidationError("in_app notifications require userId, title, and body");
      }
      const notification = await this.createInAppNotification(request);
      await this.prisma.notificationDelivery.update({
        where: { id: delivery.id },
        data: { status: "delivered" },
      });
      return { deliveryId: delivery.id, status: "delivered", notificationId: notification.id };
    }

    const syncAuth =
      request.kind === "auth" &&
      (request.channel === "email" || request.template === "transactional.password_reset_sms");

    if (syncAuth) {
      await this.deliverNow(delivery.id, request);
      const updated = await this.prisma.notificationDelivery.findUniqueOrThrow({
        where: { id: delivery.id },
      });
      return { deliveryId: delivery.id, status: updated.status };
    }

    await this.prisma.notificationDelivery.update({
      where: { id: delivery.id },
      data: { status: "queued" },
    });
    await this.queue.add("deliver", { deliveryId: delivery.id }, { jobId: delivery.id });

    return { deliveryId: delivery.id, status: "queued" };
  }

  async deliverNow(deliveryId: string, request?: SendNotificationRequest): Promise<void> {
    const delivery = await this.prisma.notificationDelivery.findUniqueOrThrow({
      where: { id: deliveryId },
    });

    const payload =
      request ??
      ({
        kind: delivery.kind,
        channel: delivery.channel,
        template: delivery.template,
        to: delivery.toAddress ?? undefined,
        userId: delivery.userId ?? undefined,
      } as SendNotificationRequest);

    try {
      if (payload.channel === "email") {
        await this.sendEmailTemplate(payload);
      } else if (payload.channel === "sms") {
        await this.sendSmsTemplate(payload);
      }
      await this.prisma.notificationDelivery.update({
        where: { id: deliveryId },
        data: { status: "sent" },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Delivery ${deliveryId} failed: ${message}`);
      await this.prisma.notificationDelivery.update({
        where: { id: deliveryId },
        data: { status: "failed", error: message },
      });
      throw err;
    }
  }

  // ── Inbox ────────────────────────────────────────────────────────────────

  async listInbox(userId: string, params: InboxQueryDto): Promise<PaginatedNotificationsResponse> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    const where = {
      userId,
      ...(params.unreadOnly ? { readAt: null } : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return {
      data: rows.map((row) => this.toNotificationResponse(row)),
      meta: { total, page, pageSize, totalPages },
    };
  }

  async markRead(userId: string, notificationId: string): Promise<NotificationResponse> {
    const row = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });
    if (!row) throw new NotFoundError("Notification", notificationId);

    const updated =
      row.readAt != null
        ? row
        : await this.prisma.notification.update({
            where: { id: notificationId },
            data: { readAt: new Date() },
          });

    return this.toNotificationResponse(updated);
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }

  // ── Preferences ──────────────────────────────────────────────────────────

  async getPreferences(userId: string): Promise<NotificationPreferencesResponse> {
    const prefs = await this.ensurePreferences(userId);
    return this.toPreferencesResponse(prefs);
  }

  async updatePreferences(
    userId: string,
    dto: UpdateNotificationPreferencesDto,
  ): Promise<NotificationPreferencesResponse> {
    await this.ensurePreferences(userId);

    const updated = await this.prisma.notificationPreference.update({
      where: { userId },
      data: {
        ...(dto.emailTransactional !== undefined
          ? { emailTransactional: dto.emailTransactional }
          : {}),
        ...(dto.emailMarketing !== undefined ? { emailMarketing: dto.emailMarketing } : {}),
        ...(dto.smsTransactional !== undefined ? { smsTransactional: dto.smsTransactional } : {}),
        ...(dto.smsMarketing !== undefined ? { smsMarketing: dto.smsMarketing } : {}),
        ...(dto.inApp !== undefined ? { inApp: dto.inApp } : {}),
      },
    });

    if (dto.emailMarketing === true) {
      await this.recordMarketingConsent(userId, "email", "settings");
    }
    if (dto.smsMarketing === true) {
      await this.recordMarketingConsent(userId, "sms", "settings");
    }

    return this.toPreferencesResponse(updated);
  }

  // ── Inbound helpers ──────────────────────────────────────────────────────

  async createInboundNotification(
    userId: string,
    title: string,
    body: string,
    link?: string,
  ): Promise<NotificationResponse> {
    const notification = await this.createInAppNotification({
      kind: "transactional",
      channel: "in_app",
      template: "inbound.message",
      userId,
      title,
      body,
      ...(link !== undefined ? { link } : {}),
      type: "message",
    });
    return this.toNotificationResponse(notification);
  }

  async recordSmsOptOut(phone: string, source = "STOP"): Promise<void> {
    await this.prisma.smsOptOut.upsert({
      where: { phone },
      create: { phone, source },
      update: { optedOutAt: new Date(), source },
    });
  }

  async isSmsOptedOut(phone: string): Promise<boolean> {
    const row = await this.prisma.smsOptOut.findUnique({ where: { phone } });
    return row != null;
  }

  async findUserByPhone(phone: string): Promise<{ id: string } | null> {
    return this.prisma.user.findFirst({
      where: { phone },
      select: { id: true },
    });
  }

  async findUserByEmail(email: string): Promise<{ id: string } | null> {
    return this.prisma.user.findFirst({
      where: { email: email.trim().toLowerCase() },
      select: { id: true },
    });
  }

  // ── Internal ─────────────────────────────────────────────────────────────

  private validateTemplate(request: SendNotificationRequest): void {
    if (request.kind === "auth" && !AUTH_TEMPLATES.has(request.template)) {
      throw new ValidationError(`Unknown auth template: ${request.template}`);
    }
    if (
      request.kind === "transactional" &&
      !TRANSACTIONAL_TEMPLATES.has(request.template) &&
      request.channel !== "in_app"
    ) {
      throw new ValidationError(`Unknown transactional template: ${request.template}`);
    }
    if (request.kind === "marketing" && !MARKETING_TEMPLATES.has(request.template)) {
      throw new ValidationError(`Unknown marketing template: ${request.template}`);
    }
    if (request.channel !== "in_app" && !request.to) {
      throw new ValidationError("Email and SMS deliveries require a destination address");
    }
  }

  private async assertMarketingAllowed(request: SendNotificationRequest): Promise<void> {
    if (!request.userId) {
      throw new ForbiddenError("Marketing notifications require a userId");
    }

    const prefs = await this.ensurePreferences(request.userId);
    const channel = request.channel;
    if (channel === "email" && !prefs.emailMarketing) {
      throw new ForbiddenError("User has disabled email marketing");
    }
    if (channel === "sms" && !prefs.smsMarketing) {
      throw new ForbiddenError("User has disabled SMS marketing");
    }

    const consent = await this.prisma.marketingConsent.findFirst({
      where: {
        userId: request.userId,
        channel: channel === "sms" ? "sms" : "email",
        revokedAt: null,
      },
    });
    if (!consent) {
      throw new ForbiddenError("Marketing consent not recorded");
    }

    if (channel === "sms" && request.to) {
      const optedOut = await this.isSmsOptedOut(request.to);
      if (optedOut) {
        throw new ForbiddenError("Recipient has opted out of SMS");
      }
    }
  }

  private async ensurePreferences(userId: string): Promise<Awaited<ReturnType<typeof this.prisma.notificationPreference.upsert>>> {
    return this.prisma.notificationPreference.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }

  private async recordMarketingConsent(
    userId: string,
    channel: "email" | "sms",
    source: "register" | "settings" | "campaign",
  ): Promise<void> {
    await this.prisma.marketingConsent.create({
      data: { userId, channel, source },
    });
  }

  private async createInAppNotification(request: SendNotificationRequest): Promise<Notification> {
    const { userId, title, body } = request;
    if (!userId || !title || !body) {
      throw new ValidationError("In-app notifications require userId, title, and body");
    }

    const notification = await this.prisma.notification.create({
      data: {
        userId,
        title,
        body,
        link: request.link ?? null,
        type: request.type ?? "system",
        senderId: null,
      },
    });

    const response = this.toNotificationResponse(notification);
    this.gateway?.emitNotificationCreated(userId, response);

    return notification;
  }

  private async sendEmailTemplate(request: SendNotificationRequest): Promise<void> {
    const to = request.to;
    if (!to) {
      throw new ValidationError("Email delivery requires a recipient address");
    }
    const data = request.data ?? {};

    switch (request.template) {
      case "auth.welcome":
        await this.email.sendWelcomeEmail(to, data.fullName as string | null | undefined);
        break;
      case "auth.verify_email":
        await this.email.sendVerificationEmail(
          to,
          String(data.token),
          String(data.baseUrl ?? this.defaultBaseUrl()),
        );
        break;
      case "auth.password_reset":
        await this.email.sendPasswordResetEmail(
          to,
          String(data.token),
          String(data.baseUrl ?? this.defaultBaseUrl()),
        );
        break;
      case "auth.otp": {
        const code = String(data.code ?? randomInt(100000, 999999));
        await this.email.send({
          to,
          subject: "Your WarehouseJobs verification code",
          html: `<p>Your verification code is: <strong>${code}</strong></p><p>Expires in 10 minutes.</p>`,
          text: `Your verification code is: ${code}. Expires in 10 minutes.`,
        });
        break;
      }
      default: {
        const text = data.textBody as string | undefined;
        await this.email.send({
          to,
          subject: String(data.subject ?? "WarehouseJobs"),
          html: String(data.htmlBody ?? data.textBody ?? request.body ?? ""),
          ...(text !== undefined ? { text } : {}),
        });
      }
    }
  }

  private async sendSmsTemplate(request: SendNotificationRequest): Promise<void> {
    const to = request.to;
    if (!to) {
      throw new ValidationError("SMS delivery requires a recipient phone number");
    }
    const data = request.data ?? {};

    if (request.template === "transactional.password_reset_sms") {
      await this.sms.sendTransactional(
        to,
        "WarehouseJobs: Password reset requested. Check your email for the secure link.",
      );
      return;
    }

    const body = String(data.body ?? request.body ?? "WarehouseJobs notification");
    await this.sms.sendTransactional(to, body);
  }

  private defaultBaseUrl(): string {
    return this.config.get("CORS_ORIGIN", { infer: true }) ?? "http://localhost:5173";
  }

  private toNotificationResponse(row: Notification): NotificationResponse {
    return {
      id: row.id,
      userId: row.userId,
      title: row.title,
      body: row.body,
      link: row.link,
      type: row.type,
      senderId: row.senderId,
      read: row.readAt != null,
      readAt: row.readAt,
      createdAt: row.createdAt,
    };
  }

  private toPreferencesResponse(prefs: {
    emailTransactional: boolean;
    emailMarketing: boolean;
    smsTransactional: boolean;
    smsMarketing: boolean;
    inApp: boolean;
  }): NotificationPreferencesResponse {
    return {
      emailTransactional: prefs.emailTransactional,
      emailMarketing: prefs.emailMarketing,
      smsTransactional: prefs.smsTransactional,
      smsMarketing: prefs.smsMarketing,
      inApp: prefs.inApp,
    };
  }
}

export { hashCode };
