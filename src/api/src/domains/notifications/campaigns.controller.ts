import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "../../core/database/prisma-client.js";
import { CurrentUser } from "../../core/auth/current-user.decorator.js";
import type { AuthUser } from "../../core/auth/jwt.strategy.js";
import { Roles } from "../../core/auth/roles.decorator.js";
import { RolesGuard } from "../../core/auth/roles.guard.js";
import { CampaignService } from "./campaign.service.js";
import { CreateCampaignDto, ListCampaignsQueryDto } from "./dto/campaign.dto.js";
import type { CampaignStatsResponse, MarketingCampaignResponse } from "./types.js";

@ApiTags("Admin — Campaigns")
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(UserRole.admin)
@Controller({ path: "admin/campaigns", version: "1" })
export class CampaignsController {
  constructor(private readonly campaigns: CampaignService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create marketing campaign" })
  create(
    @Body() dto: CreateCampaignDto,
    @CurrentUser() user: AuthUser,
  ): Promise<MarketingCampaignResponse> {
    return this.campaigns.create(dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: "List marketing campaigns" })
  list(@Query() query: ListCampaignsQueryDto): ReturnType<CampaignService["list"]> {
    return this.campaigns.list(query);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get marketing campaign" })
  get(@Param("id") id: string): Promise<MarketingCampaignResponse> {
    return this.campaigns.get(id);
  }

  @Post(":id/send")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Send marketing campaign" })
  send(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<MarketingCampaignResponse> {
    return this.campaigns.send(id, user.id);
  }

  @Get(":id/stats")
  @ApiOperation({ summary: "Campaign delivery stats" })
  stats(@Param("id") id: string): Promise<CampaignStatsResponse> {
    return this.campaigns.stats(id);
  }
}
