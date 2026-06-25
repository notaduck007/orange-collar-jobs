import { Body, Controller, Get, Param, Patch, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { UserRole } from "../../core/database/prisma-client.js";
import { CurrentUser } from "../../core/auth/current-user.decorator.js";
import type { AuthUser } from "../../core/auth/jwt.strategy.js";
import { Roles } from "../../core/auth/roles.decorator.js";
import { RolesGuard } from "../../core/auth/roles.guard.js";
import { AdminJobSearchDto } from "./dto/admin-job-search.dto.js";
import { FeatureJobDto } from "./dto/feature-job.dto.js";
import { JobsService } from "./jobs.service.js";
import type { JobResponse, PaginatedJobResponses } from "./types.js";

@ApiTags("Admin — Jobs")
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(UserRole.admin)
@Controller({ path: "admin/jobs", version: "1" })
export class AdminJobsController {
  constructor(private readonly jobsService: JobsService) {}

  // x-implemented: GET /api/v1/admin/jobs
  @Get()
  @ApiOperation({ summary: "List all jobs (admin)" })
  @ApiResponse({ status: 200, description: "Paginated jobs" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  adminSearch(@Query() dto: AdminJobSearchDto): Promise<PaginatedJobResponses> {
    return this.jobsService.adminSearch(dto);
  }

  // x-implemented: PATCH /api/v1/admin/jobs/:id/feature
  @Patch(":id/feature")
  @ApiOperation({ summary: "Toggle featured status" })
  @ApiResponse({ status: 200, description: "Updated job" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  @ApiResponse({ status: 404, description: "Job not found" })
  featureJob(
    @Param("id") id: string,
    @Body() dto: FeatureJobDto,
    @CurrentUser() user: AuthUser,
  ): Promise<JobResponse> {
    return this.jobsService.featureJob(id, dto, user);
  }
}
