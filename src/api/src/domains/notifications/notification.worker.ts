import { Processor, Process } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import type { Job } from "bull";
import { PrismaService } from "../../core/database/prisma.service.js";
import { QUEUE_NOTIFICATIONS } from "../../core/queue/queue.module.js";
import { NotificationsService } from "./notifications.service.js";
import type { CampaignSendJobData, NotificationJobData } from "./types.js";

@Processor(QUEUE_NOTIFICATIONS)
export class NotificationWorker {
  private readonly logger = new Logger(NotificationWorker.name);
  private static readonly MAX_ATTEMPTS = 3;

  constructor(
    private readonly notifications: NotificationsService,
    private readonly prisma: PrismaService,
  ) {}

  @Process("deliver")
  async handleDeliver(job: Job<NotificationJobData>): Promise<void> {
    const { deliveryId } = job.data;
    this.logger.log(`Delivering notification ${deliveryId} (attempt ${job.attemptsMade + 1})`);

    try {
      await this.notifications.deliverNow(deliveryId);
    } catch (err) {
      if (job.attemptsMade + 1 >= NotificationWorker.MAX_ATTEMPTS) {
        this.logger.error(`Delivery ${deliveryId} dead-lettered after ${job.attemptsMade + 1} attempts`);
      }
      throw err;
    }
  }

  @Process("campaign-send")
  async handleCampaignSend(job: Job<CampaignSendJobData>): Promise<void> {
    const { campaignId, userIds } = job.data;
    const campaign = await this.prisma.notificationCampaign.findUniqueOrThrow({
      where: { id: campaignId },
    });

    for (const userId of userIds) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) continue;

      const address = campaign.channel === "email" ? user.email : user.phone;
      if (!address) continue;

      try {
        await this.notifications.send({
          kind: "marketing",
          channel: campaign.channel,
          template: "marketing.campaign",
          userId,
          to: address,
          campaignId,
          idempotencyKey: `campaign-${campaignId}-${userId}`,
          data: {
            subject: campaign.subject,
            htmlBody: campaign.htmlBody,
            textBody: campaign.textBody,
          },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Campaign ${campaignId} skip user ${userId}: ${message}`);
        await this.prisma.notificationDelivery.create({
          data: {
            userId,
            channel: campaign.channel,
            kind: "marketing",
            template: "marketing.campaign",
            status: "skipped",
            campaignId,
            toAddress: address,
            error: message,
          },
        });
      }
    }

    await this.prisma.notificationCampaign.update({
      where: { id: campaignId },
      data: { status: "sent", sentAt: new Date() },
    });
  }
}
