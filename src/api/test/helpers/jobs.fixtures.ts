import type { Company, CompanyPackage, User } from "@prisma/client";
import type { PrismaService } from "../../src/core/database/prisma.service.js";
import * as bcrypt from "bcryptjs";

export const JOB_CREATE_BODY = {
  title: "Reach Truck Operator — 2nd Shift",
  category: "Forklift Operator",
  location: "Dallas, TX",
  city: "Dallas",
  state: "TX",
  zip: "75201",
  employmentType: "full_time" as const,
  shift: "second" as const,
  payMin: 18,
  payMax: 22,
  payPeriod: "hour" as const,
  description:
    "Operate reach trucks in a fast-paced warehouse environment. Must follow safety protocols.",
  requirements: "1+ years warehouse experience",
  overtimeAvailable: true,
  weeklyPay: true,
};

export async function createTestAdmin(
  prisma: PrismaService,
  email = "admin-jobs@test.com",
): Promise<User> {
  return prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash("SecureP@ss1", 12),
      role: "admin",
      fullName: "Jobs Admin",
      emailVerifiedAt: new Date(),
    },
  });
}

export async function createTestVendorWithPackage(
  prisma: PrismaService,
  email = "vendor-jobs@test.com",
): Promise<{ user: User; company: Company; package: CompanyPackage }> {
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash("SecureP@ss1", 12),
      role: "vendor",
      fullName: "Jobs Vendor",
      emailVerifiedAt: new Date(),
    },
  });
  const company = await prisma.company.create({
    data: {
      ownerId: user.id,
      name: "Test Warehouse Co",
      slug: `test-warehouse-${user.id.slice(0, 8)}`,
    },
  });
  const pkg = await prisma.companyPackage.create({
    data: {
      companyId: company.id,
      name: "Starter Pack",
      totalCredits: 10,
      usedCredits: 0,
    },
  });
  return { user, company, package: pkg };
}

export async function cleanupJobsTestData(prisma: PrismaService, emails: string[]): Promise<void> {
  const users = await prisma.user.findMany({ where: { email: { in: emails } } });
  const userIds = users.map((u) => u.id);
  const companies = await prisma.company.findMany({ where: { ownerId: { in: userIds } } });
  const companyIds = companies.map((c) => c.id);

  await prisma.screeningQuestion.deleteMany({
    where: { job: { companyId: { in: companyIds } } },
  });
  await prisma.job.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.companyPackage.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
  await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}
