import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/core/database/prisma-client.js";

const connectionString =
  process.env["TEST_DATABASE_URL"] ?? process.env["DATABASE_URL"];

if (!connectionString) {
  throw new Error("TEST_DATABASE_URL or DATABASE_URL is required for integration tests");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

export async function connectTestDb(): Promise<void> {
  await prisma.$connect();
}

export async function disconnectTestDb(): Promise<void> {
  await prisma.$disconnect();
}

/** Truncate all tables in a safe order (respects FK constraints) */
export async function truncateAll(): Promise<void> {
  await prisma.$transaction([
    prisma.interviewBooking.deleteMany(),
    prisma.applicationAnswer.deleteMany(),
    prisma.application.deleteMany(),
    prisma.interviewSlot.deleteMany(),
    prisma.screeningQuestion.deleteMany(),
    prisma.job.deleteMany(),
    prisma.companyPackage.deleteMany(),
    prisma.company.deleteMany(),
    prisma.passwordReset.deleteMany(),
    prisma.emailVerification.deleteMany(),
    prisma.refreshToken.deleteMany(),
    prisma.user.deleteMany(),
    prisma.batchJob.deleteMany(),
    prisma.adCampaign.deleteMany(),
    prisma.apiKey.deleteMany(),
  ]);
}

export { prisma };
