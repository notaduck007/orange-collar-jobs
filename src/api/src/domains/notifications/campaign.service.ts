import { Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bull";
import type { Queue } from "bull";
import { PrismaService } from "../../core/database/prisma.service.js";
import { NotFoundError, ValidationError } from "../../core/error/errors.js";
import { QUEUE_NOTIFICATIONS } from "../../core/queue/queue.module.js";
import { NotificationsService } from "./notifications.service.js";
import type { CreateCampaignDto, ListCampaignsQueryDto } from "./dto/campaign.dto.js";
import type {
  CampaignStatsResponse,
  MarketingCampaignResponse,
  PaginatedNotificationsResponse,
} from "./types.js";

@Injectable()
export class CampaignService {
  private readonly logger = new Logger(CampaignService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    @InjectQueue(QUEUE_NOTIFICATIONS) private readonly queue: Queue,
  ) {}

  async create(dto: CreateCampaignDto, adminId: string): Promise<MarketingCampaignResponse> {
    const row = await this.prisma.notificationCampaign.create({
      data: {
        name: dto.name,
        channel: dto.channel,
        segment: (dto.segment ?? {}) as object,
        subject: dto.subject ?? null,
        htmlBody: dto.htmlBody ?? null,
        textBody: dto.textBody ?? null,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        status: dto.scheduledAt ? "scheduled" : "draft",
        createdById: adminId,
      },
    });
    return this.toCampaignResponse(row);
  }

  async list(query: ListCampaignsQueryDto): Promise<{
    data: MarketingCampaignResponse[];
    meta: PaginatedNotificationsResponse["meta"];
  }> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = query.status ? { status: query.status } : {};

    const [total, rows] = await Promise.all([
      this.prisma.notificationCampaign.count({ where }),
      this.prisma.notificationCampaign.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      data: rows.map((row) => this.toCampaignResponse(row)),
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  async get(campaignId: string): Promise<MarketingCampaignResponse> {
    const row = await this.prisma.notificationCampaign.findUnique({ where: { id: campaignId } });
    if (!row) throw new NotFoundError("MarketingCampaign", campaignId);
    return this.toCampaignResponse(row);
  }

  async send(campaignId: string, adminId: string): Promise<MarketingCampaignResponse> {
    const campaign = await this.prisma.notificationCampaign.findUnique({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundError("MarketingCampaign", campaignId);
    if (campaign.status === "sent" || campaign.status === "sending") {
      throw new ValidationError("Campaign already sent or in progress");
    }

    const recipients = await this.resolveSegment(campaign.channel, campaign.segment);
    if (recipients.length === 0) {
      throw new ValidationError("No eligible recipients in segment");
    }
    if (!campaign.textBody && !campaign.htmlBody && campaign.channel === "email") {
      throw new ValidationError("Email campaigns require htmlBody or textBody");
    }

    await this.prisma.notificationCampaign.update({
      where: { id: campaignId },
      data: { status: "sending" },
    });

    await this.queue.add(
      "campaign-send",
      { campaignId, userIds: recipients.map((r) => r.userId) },
      { jobId: `campaign-${campaignId}` },
    );

    this.logger.log(`Campaign ${campaignId} queued for ${recipients.length} recipients by ${adminId}`);

    return this.toCampaignResponse(
      await this.prisma.notificationCampaign.findUniqueOrThrow({ where: { id: campaignId } }),
    );
  }

  async stats(campaignId: string): Promise<CampaignStatsResponse> {
    const campaign = await this.prisma.notificationCampaign.findUnique({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundError("MarketingCampaign", campaignId);

    const deliveries = await this.prisma.notificationDelivery.findMany({
      where: { campaignId },
    });

    const targeted = deliveries.length;
    const sent = deliveries.filter((d) => ["sent", "delivered"].includes(d.status)).length;
    const delivered = deliveries.filter((d) => d.status === "delivered").length;
    const bounced = deliveries.filter((d) => d.status === "bounced").length;
    const failed = deliveries.filter((d) => d.status === "failed").length;
    const optedOut = deliveries.filter((d) => d.status === "skipped").length;

    return { campaignId, targeted, sent, delivered, bounced, optedOut, failed };
  }

  private async resolveSegment(
    channel: "email" | "sms",
    segment: unknown,
  ): Promise<Array<{ userId: string; address: string }>> {
    const filter = (segment ?? {}) as Record<string, unknown>;
    const roleFilter = filter.role as string | undefined;

    const users = await this.prisma.user.findMany({
      where: roleFilter ? { role: roleFilter as "admin" | "vendor" | "seeker" } : {},
      select: { id: true, email: true, phone: true },
    });

    const results: Array<{ userId: string; address: string }> = [];

    for (const user of users) {
      const prefs = await this.prisma.notificationPreference.findUnique({
        where: { userId: user.id },
      });
      const marketingEnabled =
        channel === "email" ? (prefs?.emailMarketing ?? false) : (prefs?.smsMarketing ?? false);
      if (!marketingEnabled) continue;

      const consent = await this.prisma.marketingConsent.findFirst({
        where: { userId: user.id, channel, revokedAt: null },
      });
      if (!consent) continue;

      const address = channel === "email" ? user.email : user.phone;
      if (!address) continue;

      if (channel === "sms") {
        const optedOut = await this.notifications.isSmsOptedOut(address);
        if (optedOut) continue;
      }

      results.push({ userId: user.id, address });
    }

    return results;
  }

  private toCampaignResponse(row: {
    id: string;
    name: string;
    channel: "email" | "sms";
    status: "draft" | "scheduled" | "sending" | "sent" | "cancelled" | "failed";
    segment: unknown;
    subject: string | null;
    htmlBody: string | null;
    textBody: string | null;
    scheduledAt: Date | null;
    sentAt: Date | null;
    createdAt: Date;
  }): MarketingCampaignResponse {
    return {
      id: row.id,
      name: row.name,
      channel: row.channel,
      status: row.status,
      segment: (row.segment ?? {}) as Record<string, unknown>,
      subject: row.subject,
      htmlBody: row.htmlBody,
      textBody: row.textBody,
      scheduledAt: row.scheduledAt,
      sentAt: row.sentAt,
      createdAt: row.createdAt,
    };
  }
}
