import { Injectable } from "@nestjs/common";
import type { Job, JobSourceType, Prisma } from "@prisma/client";
import type { AuthUser } from "../../core/auth/jwt.strategy.js";
import { PrismaService } from "../../core/database/prisma.service.js";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../core/error/errors.js";
import type { CreateJobDto } from "./dto/create-job.dto.js";
import type { JobSearchDto } from "./dto/job-search.dto.js";
import type { UpdateJobDto } from "./dto/update-job.dto.js";
import { buildJobSlug, slugifySegment } from "./job-slug.util.js";
import {
  toJobDetail,
  toJobResponse,
  toJobSummary,
  type JobDetailResponse,
  type JobResponse,
  type JobWithCompany,
  type PaginatedJobsResponse,
} from "./types.js";

const LISTABLE_STATUSES = ["active", "published"] as const;
const SOURCE_PRIORITY: Record<JobSourceType, number> = {
  direct: 0,
  api: 0,
  syndicated: 0,
  scraped: 1,
};

@Injectable()
export class JobsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateJobDto, user: AuthUser): Promise<JobResponse> {
    const categorySlug = dto.categorySlug?.trim() || slugifySegment(dto.category);
    const baseSlug = buildJobSlug(dto.title, dto.city, dto.state);
    const slug = await this.ensureUniqueSlug(baseSlug);

    if (user.role === "admin") {
      if (!dto.companyId) {
        throw new BadRequestError("companyId is required for admin job posts");
      }
      const status = dto.status ?? "published";
      const job = await this.prisma.job.create({
        data: this.buildCreateData(dto, {
          slug,
          categorySlug,
          companyId: dto.companyId,
          companyPackageId: dto.companyPackageId ?? null,
          status,
          sourceType: "direct",
          postedAt: this.shouldSetPostedAt(status) ? new Date() : null,
        }),
        include: { company: true },
      });
      return toJobResponse(job);
    }

    if (user.role !== "vendor") {
      throw new ForbiddenError("Only admin or vendor may create jobs");
    }

    const company = await this.prisma.company.findUnique({ where: { ownerId: user.id } });
    if (!company) {
      throw new BadRequestError("Vendor account has no company profile");
    }

    if (!dto.companyPackageId) {
      throw new BadRequestError("companyPackageId is required for vendor job posts");
    }

    const packageId = dto.companyPackageId;
    const status = dto.status ?? "draft";
    const job = await this.prisma.$transaction(async (tx) => {
      const pkg = await tx.companyPackage.findFirst({
        where: { id: packageId, companyId: company.id },
      });
      if (!pkg) {
        throw new BadRequestError("Invalid companyPackageId for this vendor");
      }
      const remaining = pkg.totalCredits - pkg.usedCredits;
      if (remaining <= 0) {
        throw new BadRequestError(`Company package '${packageId}' has no remaining credits`);
      }
      if (pkg.expiresAt && pkg.expiresAt < new Date()) {
        throw new BadRequestError("Company package has expired");
      }

      await tx.companyPackage.update({
        where: { id: pkg.id },
        data: { usedCredits: { increment: 1 } },
      });

      return tx.job.create({
        data: this.buildCreateData(dto, {
          slug,
          categorySlug,
          companyId: company.id,
          companyPackageId: pkg.id,
          status,
          sourceType: "direct",
          postedAt: this.shouldSetPostedAt(status) ? new Date() : null,
        }),
        include: { company: true },
      });
    });

    return toJobResponse(job);
  }

  async search(dto: JobSearchDto): Promise<PaginatedJobsResponse> {
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 20;
    const where: Prisma.JobWhereInput = {
      status: { in: [...LISTABLE_STATUSES] },
    };

    if (dto.q?.trim()) {
      const q = dto.q.trim();
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { category: { contains: q, mode: "insensitive" } },
        { city: { contains: q, mode: "insensitive" } },
      ];
    }
    if (dto.category) where.categorySlug = slugifySegment(dto.category);
    if (dto.city) where.city = { equals: dto.city, mode: "insensitive" };
    if (dto.state) where.state = { equals: dto.state.toUpperCase(), mode: "insensitive" };
    if (dto.zip) where.zip = dto.zip;
    if (dto.shift) where.shift = dto.shift;
    if (dto.employmentType) where.employmentType = dto.employmentType;
    if (dto.payMin != null) where.payMax = { gte: dto.payMin };
    if (dto.featured != null) where.featured = dto.featured;
    if (dto.quickHire != null) where.quickHire = dto.quickHire;
    if (dto.temperatureEnv) where.temperatureEnv = dto.temperatureEnv;

    const all = await this.prisma.job.findMany({
      where,
      include: {
        company: {
          select: { id: true, name: true, slug: true, verified: true, logoUrl: true },
        },
      },
    });

    const sorted = this.sortForSearch(all as JobWithCompany[]);
    const total = sorted.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const slice = sorted.slice((page - 1) * pageSize, page * pageSize);

    return {
      data: slice.map(toJobSummary),
      meta: { total, page, pageSize, totalPages },
    };
  }

  async findBySlug(slug: string): Promise<JobDetailResponse> {
    const job = await this.prisma.job.findFirst({
      where: {
        slug,
        status: { in: [...LISTABLE_STATUSES] },
      },
      include: {
        company: true,
        screeningQuestions: { orderBy: { sortOrder: "asc" } },
        interviewSlots: { orderBy: { startsAt: "asc" } },
      },
    });

    if (!job) {
      throw new NotFoundError("Job");
    }

    await this.prisma.job.update({
      where: { id: job.id },
      data: { views: { increment: 1 } },
    });

    const interviewSlots = job.quickHire
      ? job.interviewSlots.map((slot) => ({
          id: slot.id,
          startsAt: slot.startsAt.toISOString(),
          capacity: slot.maxBookings,
          remaining: Math.max(0, slot.maxBookings - slot.bookedCount),
        }))
      : [];

    return toJobDetail({ ...job, views: job.views + 1 }, interviewSlots);
  }

  async update(id: string, dto: UpdateJobDto, user: AuthUser): Promise<JobResponse> {
    const job = await this.prisma.job.findUnique({
      where: { id },
      include: { company: true },
    });
    if (!job) throw new NotFoundError("Job", id);
    await this.assertCanManage(job.companyId, user);

    const data: Prisma.JobUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.requirements !== undefined) data.requirements = dto.requirements;
    if (dto.status !== undefined) {
      data.status = dto.status;
      if (this.shouldSetPostedAt(dto.status) && !job.postedAt) {
        data.postedAt = new Date();
      }
    }
    if (dto.featured !== undefined) data.featured = dto.featured;
    if (dto.featuredUntil !== undefined) data.featuredUntil = dto.featuredUntil;
    if (dto.expiresAt !== undefined) data.expiresAt = dto.expiresAt;
    if (dto.payMin !== undefined) data.payMin = dto.payMin;
    if (dto.payMax !== undefined) data.payMax = dto.payMax;
    if (dto.quickHire !== undefined) data.quickHire = dto.quickHire;
    if (dto.weeklyPay !== undefined) data.weeklyPay = dto.weeklyPay;
    if (dto.overtimeAvailable !== undefined) data.overtimeAvailable = dto.overtimeAvailable;

    const updated = await this.prisma.job.update({
      where: { id },
      data,
      include: { company: true },
    });
    return toJobResponse(updated);
  }

  async softDelete(id: string, user: AuthUser): Promise<void> {
    const job = await this.prisma.job.findUnique({ where: { id } });
    if (!job) throw new NotFoundError("Job", id);
    await this.assertCanManage(job.companyId, user);

    await this.prisma.job.update({
      where: { id },
      data: { status: "closed" },
    });
  }

  private buildCreateData(
    dto: CreateJobDto,
    meta: {
      slug: string;
      categorySlug: string;
      companyId: string;
      companyPackageId: string | null;
      status: Job["status"];
      sourceType: Job["sourceType"];
      postedAt: Date | null;
    },
  ): Prisma.JobCreateInput {
    const questions = dto.screeningQuestions ?? [];
    const data: Prisma.JobCreateInput = {
      title: dto.title.trim(),
      slug: meta.slug,
      category: dto.category.trim(),
      categorySlug: meta.categorySlug,
      location: dto.location.trim(),
      city: dto.city.trim(),
      state: dto.state.trim().toUpperCase(),
      zip: dto.zip?.trim() ?? null,
      lat: dto.lat ?? null,
      lng: dto.lng ?? null,
      employmentType: dto.employmentType,
      shift: dto.shift,
      payMin: dto.payMin ?? null,
      payMax: dto.payMax ?? null,
      payPeriod: dto.payPeriod ?? null,
      description: dto.description.trim(),
      requirements: dto.requirements?.trim() ?? null,
      temperatureEnv: dto.temperatureEnv ?? null,
      certificationsRequired: dto.certificationsRequired ?? [],
      liftRequirementLbs: dto.liftRequirementLbs ?? null,
      overtimeAvailable: dto.overtimeAvailable ?? false,
      weeklyPay: dto.weeklyPay ?? false,
      quickHire: dto.quickHire ?? false,
      featured: dto.featured ?? false,
      status: meta.status,
      sourceType: meta.sourceType,
      postedAt: meta.postedAt,
      company: { connect: { id: meta.companyId } },
    };

    if (meta.companyPackageId) {
      data.package = { connect: { id: meta.companyPackageId } };
    }

    if (questions.length > 0) {
      data.screeningQuestions = {
        create: questions.map((q) => ({
          prompt: q.prompt.trim(),
          type: q.type,
          options: q.options ?? [],
          required: q.required,
          sortOrder: q.sortOrder,
        })),
      };
    }

    return data;
  }

  private async ensureUniqueSlug(base: string): Promise<string> {
    let slug = base;
    let suffix = 2;
    while (await this.prisma.job.findUnique({ where: { slug } })) {
      slug = `${base}-${suffix}`;
      suffix += 1;
    }
    return slug;
  }

  private shouldSetPostedAt(status: Job["status"]): boolean {
    return status === "published" || status === "active";
  }

  private sortForSearch(jobs: JobWithCompany[]): JobWithCompany[] {
    return [...jobs].sort((a, b) => {
      const featuredDiff = (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
      if (featuredDiff !== 0) return featuredDiff;

      const sourceDiff = SOURCE_PRIORITY[a.sourceType] - SOURCE_PRIORITY[b.sourceType];
      if (sourceDiff !== 0) return sourceDiff;

      const aPosted = a.postedAt?.getTime() ?? a.createdAt.getTime();
      const bPosted = b.postedAt?.getTime() ?? b.createdAt.getTime();
      return bPosted - aPosted;
    });
  }

  private async assertCanManage(companyId: string | null, user: AuthUser): Promise<void> {
    if (user.role === "admin") return;
    if (user.role !== "vendor") {
      throw new ForbiddenError("Only admin or vendor may manage jobs");
    }
    const company = await this.prisma.company.findUnique({ where: { ownerId: user.id } });
    if (!company || company.id !== companyId) {
      throw new ForbiddenError("You may only manage your company's jobs");
    }
  }
}
