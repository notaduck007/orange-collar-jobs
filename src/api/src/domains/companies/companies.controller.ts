import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../core/auth/jwt-auth.guard.js";
import { CurrentUser } from "../../core/auth/current-user.decorator.js";
import type { AuthUser } from "../../core/auth/jwt.strategy.js";
import { CompaniesService } from "./companies.service.js";
import { UpsertCompanyDto } from "./dto/upsert-company.dto.js";

@ApiTags("Companies")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: "companies", version: "1" })
export class CompaniesController {
  constructor(private readonly companies: CompaniesService) {}

  @Get("mine")
  @ApiOperation({ summary: "Get the caller's company profile" })
  @HttpCode(HttpStatus.OK)
  async getMyCompany(@CurrentUser() user: AuthUser): Promise<object | void> {
    const company = await this.companies.findByOwner(user.id);
    if (!company) {
      throw new NotFoundException("No company found for this user.");
    }
    return company;
  }

  @Post()
  @ApiOperation({ summary: "Create a company profile" })
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: UpsertCompanyDto,
    @CurrentUser() user: AuthUser,
  ): Promise<object> {
    return this.companies.create(user.id, dto);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a company profile" })
  async update(
    @Param("id") id: string,
    @Body() dto: UpsertCompanyDto,
    @CurrentUser() user: AuthUser,
  ): Promise<object> {
    return this.companies.update(user.id, id, dto);
  }
}
