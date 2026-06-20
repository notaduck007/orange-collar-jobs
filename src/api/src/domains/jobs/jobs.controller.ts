import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { UserRole } from "../../core/database/prisma-client.js";
import { Public } from "../../core/auth/public.decorator.js";
import { CurrentUser } from "../../core/auth/current-user.decorator.js";
import type { AuthUser } from "../../core/auth/jwt.strategy.js";
import { Roles } from "../../core/auth/roles.decorator.js";
import { RolesGuard } from "../../core/auth/roles.guard.js";
import { CreateJobDto } from "./dto/create-job.dto.js";
import { JobSearchDto } from "./dto/job-search.dto.js";
import { UpdateJobDto } from "./dto/update-job.dto.js";
import { JobsService } from "./jobs.service.js";
import type { JobDetailResponse, JobResponse, PaginatedJobsResponse } from "./types.js";

@ApiTags("Jobs")
@Controller({ path: "jobs", version: "1" })
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: "Search jobs" })
  @ApiResponse({ status: 200, description: "Paginated job listing" })
  search(@Query() dto: JobSearchDto): Promise<PaginatedJobsResponse> {
    return this.jobsService.search(dto);
  }

  @Public()
  @Get(":slug")
  @ApiOperation({ summary: "Get job detail by slug" })
  @ApiResponse({ status: 200, description: "Job detail" })
  @ApiResponse({ status: 404, description: "Job not found" })
  findBySlug(@Param("slug") slug: string): Promise<JobDetailResponse> {
    return this.jobsService.findBySlug(slug);
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin, UserRole.vendor)
  @ApiOperation({ summary: "Post a job" })
  @ApiResponse({ status: 201, description: "Job created" })
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateJobDto, @CurrentUser() user: AuthUser): Promise<JobResponse> {
    return this.jobsService.create(dto, user);
  }

  @Patch(":id")
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin, UserRole.vendor)
  @ApiOperation({ summary: "Update job" })
  @ApiResponse({ status: 200, description: "Updated job" })
  update(
    @Param("id") id: string,
    @Body() dto: UpdateJobDto,
    @CurrentUser() user: AuthUser,
  ): Promise<JobResponse> {
    return this.jobsService.update(id, dto, user);
  }

  @Delete(":id")
  @ApiBearerAuth()
  @UseGuards(RolesGuard)
  @Roles(UserRole.admin, UserRole.vendor)
  @ApiOperation({ summary: "Close / delete job" })
  @ApiResponse({ status: 204, description: "Job closed" })
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param("id") id: string, @CurrentUser() user: AuthUser): Promise<void> {
    await this.jobsService.softDelete(id, user);
  }
}
