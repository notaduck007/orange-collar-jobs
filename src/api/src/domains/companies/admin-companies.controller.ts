import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";
import { JwtAuthGuard } from "../../core/auth/jwt-auth.guard.js";
import { RolesGuard } from "../../core/auth/roles.guard.js";
import { Roles } from "../../core/auth/roles.decorator.js";
import { CurrentUser } from "../../core/auth/current-user.decorator.js";
import type { AuthUser } from "../../core/auth/jwt.strategy.js";
import { CompaniesService } from "./companies.service.js";
import type { PaginationMeta } from "../jobs/types.js";

class AdminListCompaniesQuery {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsEnum(["unverified", "pending", "verified", "rejected"])
  verificationStatus?: string;

  @IsOptional()
  @IsEnum(["active", "suspended"])
  status?: string;

  @IsOptional()
  page?: number;

  @IsOptional()
  pageSize?: number;
}

class AdminUpdateCompanyDto {
  @IsOptional()
  @IsEnum(["active", "suspended"])
  status?: string;

  @IsOptional()
  verified?: boolean;

  @IsOptional()
  @IsEnum(["unverified", "pending", "verified", "rejected"])
  verificationStatus?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  verificationNote?: string | null;
}

@ApiTags("Admin — Companies")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
@Controller({ path: "admin/companies", version: "1" })
export class AdminCompaniesController {
  constructor(private readonly companies: CompaniesService) {}

  @Get()
  @ApiOperation({ summary: "List all companies (admin)" })
  async list(
    @Query() query: AdminListCompaniesQuery,
  ): Promise<{ data: object[]; meta: PaginationMeta }> {
    return this.companies.adminList({
      q: query.q,
      verificationStatus: query.verificationStatus,
      status: query.status,
      page: query.page ? Number(query.page) : 1,
      pageSize: query.pageSize ? Number(query.pageSize) : 20,
    });
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a company (verify, suspend, reject)" })
  async update(
    @Param("id") id: string,
    @Body() dto: AdminUpdateCompanyDto,
    @CurrentUser() admin: AuthUser,
  ): Promise<object> {
    const result = await this.companies.adminUpdate(id, admin.id, dto);
    if (!result) throw new NotFoundException("Company not found.");
    return result;
  }
}
