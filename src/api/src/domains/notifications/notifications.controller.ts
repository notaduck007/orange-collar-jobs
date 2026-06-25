import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../core/auth/current-user.decorator.js";
import type { AuthUser } from "../../core/auth/jwt.strategy.js";
import { InboxQueryDto } from "./dto/inbox-query.dto.js";
import { UpdateNotificationPreferencesDto } from "./dto/update-preferences.dto.js";
import { NotificationsService } from "./notifications.service.js";
import type {
  NotificationPreferencesResponse,
  NotificationResponse,
  PaginatedNotificationsResponse,
} from "./types.js";

@ApiTags("Notifications")
@ApiBearerAuth()
@Controller({ path: "notifications", version: "1" })
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get("preferences")
  @ApiOperation({ summary: "Get notification preferences" })
  getPreferences(@CurrentUser() user: AuthUser): Promise<NotificationPreferencesResponse> {
    return this.notifications.getPreferences(user.id);
  }

  @Patch("preferences")
  @ApiOperation({ summary: "Update notification preferences" })
  updatePreferences(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateNotificationPreferencesDto,
  ): Promise<NotificationPreferencesResponse> {
    return this.notifications.updatePreferences(user.id, dto);
  }

  @Post("read-all")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Mark all notifications read" })
  markAllRead(@CurrentUser() user: AuthUser): Promise<{ updated: number }> {
    return this.notifications.markAllRead(user.id);
  }

  @Get()
  @ApiOperation({ summary: "List in-app notifications" })
  @ApiResponse({ status: 200, description: "Paginated notifications" })
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: InboxQueryDto,
  ): Promise<PaginatedNotificationsResponse> {
    return this.notifications.listInbox(user.id, query);
  }

  @Patch(":id/read")
  @ApiOperation({ summary: "Mark notification read" })
  @ApiResponse({ status: 200, description: "Updated notification" })
  markRead(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
  ): Promise<NotificationResponse> {
    return this.notifications.markRead(user.id, id);
  }
}
