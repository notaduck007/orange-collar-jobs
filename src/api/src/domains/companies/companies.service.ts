import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../core/database/prisma.service.js";
import { slugifySegment } from "../jobs/job-slug.util.js";
import { randomBytes } from "node:crypto";
import type { UpsertCompanyDto } from "./dto/upsert-company.dto.js";
import type { PaginationMeta } from "../jobs/types.js";

export interface CompanyResponse {
  id: string;
  ownerId: string | null;
  name: string;
  slug: string;
  description: string | null;
  website: string | null;
  logoUrl: string | null;
  industry: string | null;
  hqCity: string | null;
  hqState: string | null;
  location: string | null;
  status: string;
  verified: boolean;
  verificationStatus: string;
  verifiedAt: Date | null;
  verifiedBy: string | null;
  verificationNote: string | null;
  createdAt: Date;
}

@Injectable()
export class CompaniesService {
  private readonly logger = new Logger(CompaniesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findByOwner(ownerId: string): Promise<CompanyResponse | null> {
    return this.prisma.company.findUnique({ where: { ownerId } });
  }

  async create(ownerId: string, dto: UpsertCompanyDto): Promise<CompanyResponse> {
    const existing = await this.prisma.company.findUnique({ where: { ownerId } });
    if (existing) {
      throw new ConflictException("A company already exists for this owner.");
    }

    const slug = await this.buildUniqueSlug(dto.name);
    const location = `${dto.hqCity}, ${dto.hqState}`;

    const company = await this.prisma.company.create({
      data: {
        ownerId,
        name: dto.name,
        slug,
        description: dto.description ?? null,
        website: dto.website ?? null,
        logoUrl: dto.logoUrl ?? null,
        industry: dto.industry,
        hqCity: dto.hqCity,
        hqState: dto.hqState,
        location,
      },
    });

    await this.grantStarterPackage(company.id, ownerId).catch((err: unknown) => {
      this.logger.warn(
        `starter package grant failed for company ${company.id}: ${String(err)}`,
      );
    });

    return company;
  }

  async update(
    requesterId: string,
    companyId: string,
    dto: UpsertCompanyDto,
  ): Promise<CompanyResponse> {
    const existing = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!existing) throw new NotFoundException("Company not found.");
    if (existing.ownerId !== requesterId) {
      throw new ForbiddenException("Only the company owner may update this profile.");
    }

    const location = `${dto.hqCity}, ${dto.hqState}`;

    return this.prisma.company.update({
      where: { id: companyId },
      data: {
        name: dto.name,
        description: dto.description ?? null,
        website: dto.website ?? null,
        logoUrl: dto.logoUrl ?? null,
        industry: dto.industry,
        hqCity: dto.hqCity,
        hqState: dto.hqState,
        location,
      },
    });
  }

  // ── Admin methods ──────────────────────────────────────────────────────────

  async adminList(opts: {
    q?: string | undefined;
    verificationStatus?: string | undefined;
    status?: string | undefined;
    page: number;
    pageSize: number;
  }): Promise<{ data: CompanyResponse[]; meta: PaginationMeta }> {
    const { q, verificationStatus, status, page, pageSize } = opts;
    const where = {
      ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
      ...(verificationStatus ? { verificationStatus } : {}),
      ...(status ? { status } : {}),
    };
    const [total, data] = await Promise.all([
      this.prisma.company.count({ where }),
      this.prisma.company.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return {
      data,
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async adminUpdate(
    id: string,
    adminId: string,
    patch: {
      status?: string;
      verified?: boolean;
      verificationStatus?: string;
      verificationNote?: string | null;
    },
  ): Promise<CompanyResponse | null> {
    const existing = await this.prisma.company.findUnique({ where: { id } });
    if (!existing) return null;

    const now = new Date();
    const isVerifying = patch.verificationStatus === "verified" && patch.verified === true;
    const isRejecting = patch.verificationStatus === "rejected";

    return this.prisma.company.update({
      where: { id },
      data: {
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.verified !== undefined ? { verified: patch.verified } : {}),
        ...(patch.verificationStatus !== undefined
          ? { verificationStatus: patch.verificationStatus }
          : {}),
        ...(patch.verificationNote !== undefined
          ? { verificationNote: patch.verificationNote }
          : {}),
        ...(isVerifying || isRejecting
          ? { verifiedAt: isVerifying ? now : null, verifiedBy: adminId }
          : {}),
      },
    });
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async buildUniqueSlug(name: string): Promise<string> {
    const base = slugifySegment(name);
    const candidate = base;
    const exists = await this.prisma.company.findUnique({ where: { slug: candidate } });
    if (!exists) return candidate;
    // Append a short random suffix to avoid collision
    const suffix = randomBytes(2).toString("hex");
    return `${base}-${suffix}`;
  }

  /**
   * Replicates grant_starter_package logic directly via Prisma (bypasses RLS).
   * Idempotent: no-ops if the company already has a package.
   */
  private async grantStarterPackage(companyId: string, _ownerId: string): Promise<void> {
    const existingPkg = await this.prisma.companyPackage.findFirst({
      where: { companyId },
    });
    if (existingPkg) return; // already has a package

    const starterPkg = await this.prisma.$queryRaw<
      Array<{ id: string; posting_count: number; featured_count: number }>
    >`
      SELECT id, posting_count, featured_count
      FROM public.packages
      WHERE name = 'Starter' AND price_cents = 0
      ORDER BY created_at ASC
      LIMIT 1
    `;
    if (!starterPkg.length) {
      this.logger.warn("No Starter package found in packages table — skipping grant.");
      return;
    }

    const pkg = starterPkg[0];
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await this.prisma.$transaction(async (tx) => {
      const [orderId] = await tx.$queryRaw<Array<{ id: string }>>`
        INSERT INTO public.orders (
          company_id, package_id, amount_cents, currency, status,
          posting_count_granted, featured_count_granted, package_snapshot, fulfilled_at
        ) VALUES (
          ${companyId}::uuid, ${pkg.id}::uuid, 0, 'usd', 'paid',
          ${pkg.posting_count}, ${pkg.featured_count},
          jsonb_build_object('name', 'Starter', 'starter', true),
          now()
        ) RETURNING id
      `;

      await tx.$executeRaw`
        INSERT INTO public.company_packages (
          company_id, package_id, order_id,
          posts_total, posts_used, featured_total, featured_used,
          purchased_at, expires_at, status
        ) VALUES (
          ${companyId}::uuid, ${pkg.id}::uuid, ${orderId.id}::uuid,
          ${pkg.posting_count}, 0, ${pkg.featured_count}, 0,
          now(), ${expiresAt}, 'active'
        )
      `;

      if (pkg.posting_count > 0) {
        await tx.$executeRaw`
          INSERT INTO public.company_credits (company_id, credit_type, balance)
          VALUES (${companyId}::uuid, 'post', ${pkg.posting_count})
          ON CONFLICT (company_id, credit_type)
          DO UPDATE SET balance = company_credits.balance + EXCLUDED.balance,
                        updated_at = now()
        `;
        await tx.$executeRaw`
          INSERT INTO public.credit_transactions (company_id, credit_type, delta, reason, order_id)
          VALUES (${companyId}::uuid, 'post', ${pkg.posting_count}, 'starter_grant', ${orderId.id}::uuid)
        `;
      }
    });
  }
}
