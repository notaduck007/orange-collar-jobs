import type { PrismaService } from "../../src/core/database/prisma.service.js";
import type { User } from "../../src/core/database/prisma-client.js";
import * as bcrypt from "bcryptjs";

export const SEEKER_EMAIL = "notifications-seeker@test.com";
export const ADMIN_EMAIL = "notifications-admin@test.com";

export async function createTestSeeker(
  prisma: PrismaService,
  email = SEEKER_EMAIL,
): Promise<User> {
  return prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash("SecureP@ss1", 12),
      role: "seeker",
      fullName: "Notify Seeker",
      emailVerifiedAt: new Date(),
      phone: "+15559876543",
    },
  });
}

export async function createTestNotificationsAdmin(
  prisma: PrismaService,
  email = ADMIN_EMAIL,
): Promise<User> {
  return prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash("SecureP@ss1", 12),
      role: "admin",
      fullName: "Notify Admin",
      emailVerifiedAt: new Date(),
    },
  });
}

export async function seedInAppNotification(
  prisma: PrismaService,
  userId: string,
  title = "Test notification",
): Promise<{ id: string }> {
  return prisma.notification.create({
    data: {
      userId,
      title,
      body: "Fixture body",
      type: "system",
    },
    select: { id: true },
  });
}

export async function seedMarketingConsent(
  prisma: PrismaService,
  userId: string,
  channel: "email" | "sms" = "email",
): Promise<void> {
  await prisma.notificationPreference.upsert({
    where: { userId },
    create: {
      userId,
      emailMarketing: channel === "email",
      smsMarketing: channel === "sms",
    },
    update: {
      emailMarketing: channel === "email" ? true : undefined,
      smsMarketing: channel === "sms" ? true : undefined,
    },
  });
  await prisma.marketingConsent.create({
    data: { userId, channel, source: "settings" },
  });
}

export async function cleanupNotificationsData(
  prisma: PrismaService,
  emails: string[] = [SEEKER_EMAIL, ADMIN_EMAIL],
): Promise<void> {
  const users = await prisma.user.findMany({ where: { email: { in: emails } } });
  const userIds = users.map((u) => u.id);

  await prisma.notificationDelivery.deleteMany({
    where: { OR: [{ userId: { in: userIds } }, { campaignId: { not: null } }] },
  });
  await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.notificationPreference.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.marketingConsent.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.userMfa.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.otpChallenge.deleteMany({
    where: { OR: [{ userId: { in: userIds } }, { destination: { contains: "@test.com" } }] },
  });
  await prisma.notificationCampaign.deleteMany({});
  await prisma.smsOptOut.deleteMany({ where: { phone: "+15559876543" } });
  await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}
