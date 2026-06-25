import { Module } from "@nestjs/common";
import { NotificationsController } from "./notifications.controller.js";
import { WebhooksController } from "./webhooks.controller.js";
import { CampaignsController } from "./campaigns.controller.js";
import { NotificationsService } from "./notifications.service.js";
import { CampaignService } from "./campaign.service.js";
import { OtpService } from "./otp.service.js";
import { InboundMessageHandler } from "./inbound-message.handler.js";
import { NotificationWorker } from "./notification.worker.js";
import { NotificationGateway } from "./notification.gateway.js";

@Module({
  controllers: [NotificationsController, WebhooksController, CampaignsController],
  providers: [
    NotificationsService,
    CampaignService,
    OtpService,
    InboundMessageHandler,
    NotificationWorker,
    NotificationGateway,
  ],
  exports: [NotificationsService, OtpService],
})
export class NotificationsModule {}
