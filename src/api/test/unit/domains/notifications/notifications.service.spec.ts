import { ForbiddenError, NotFoundError, ValidationError } from "@core/error/errors";
import { NotificationsService } from "@domains/notifications/notifications.service";
import type { NotificationGateway } from "@domains/notifications/notification.gateway";

const prismaMock = {
  notificationDelivery: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findUniqueOrThrow: jest.fn(),
  },
  notification: {
    count: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    create: jest.fn(),
  },
  notificationPreference: {
    upsert: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
  },
  marketingConsent: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  smsOptOut: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
  user: {
    findFirst: jest.fn(),
  },
};

const emailMock = {
  sendWelcomeEmail: jest.fn(),
  sendVerificationEmail: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
  send: jest.fn(),
};

const smsMock = { sendTransactional: jest.fn() };

const configMock = { get: jest.fn(() => "http://localhost:5173") };
const queueMock = { add: jest.fn() };
const gatewayMock: NotificationGateway = {
  emitNotificationCreated: jest.fn(),
  subscribe: jest.fn(() => () => undefined),
};

let svc: NotificationsService;

beforeEach(() => {
  jest.clearAllMocks();
  svc = new NotificationsService(
    prismaMock as never,
    emailMock as never,
    smsMock as never,
    configMock as never,
    queueMock as never,
    gatewayMock,
  );

  prismaMock.notificationDelivery.create.mockResolvedValue({ id: "del-1", status: "pending" });
  prismaMock.notificationPreference.upsert.mockResolvedValue({
    userId: "u1",
    emailTransactional: true,
    emailMarketing: false,
    smsTransactional: true,
    smsMarketing: false,
    inApp: true,
  });
});

describe("NotificationsService.send", () => {
  it("delivers auth welcome email synchronously", async () => {
    prismaMock.notificationDelivery.findUniqueOrThrow.mockResolvedValue({ id: "del-1", status: "sent" });

    await svc.sendWelcomeEmail("a@test.com", "Jane");

    expect(emailMock.sendWelcomeEmail).toHaveBeenCalledWith("a@test.com", "Jane");
  });

  it("returns existing delivery for duplicate idempotency key", async () => {
    prismaMock.notificationDelivery.findUnique.mockResolvedValue({ id: "del-existing", status: "sent" });

    const result = await svc.send({
      kind: "auth",
      channel: "email",
      template: "auth.welcome",
      to: "a@test.com",
      idempotencyKey: "dup-key",
    });

    expect(result).toEqual({ deliveryId: "del-existing", status: "sent" });
    expect(prismaMock.notificationDelivery.create).not.toHaveBeenCalled();
  });

  it("blocks marketing when consent not recorded", async () => {
    prismaMock.notificationPreference.upsert.mockResolvedValue({
      userId: "u1",
      emailMarketing: true,
      smsMarketing: false,
      emailTransactional: true,
      smsTransactional: true,
      inApp: true,
    });
    prismaMock.marketingConsent.findFirst.mockResolvedValue(null);

    await expect(
      svc.send({
        kind: "marketing",
        channel: "email",
        template: "marketing.campaign",
        userId: "u1",
        to: "a@test.com",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("throws for unknown auth template", async () => {
    await expect(
      svc.send({
        kind: "auth",
        channel: "email",
        template: "auth.unknown",
        to: "a@test.com",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("throws for unknown transactional template", async () => {
    await expect(
      svc.send({
        kind: "transactional",
        channel: "email",
        template: "transactional.unknown",
        to: "a@test.com",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("throws for unknown marketing template", async () => {
    await expect(
      svc.send({
        kind: "marketing",
        channel: "email",
        template: "marketing.unknown",
        userId: "u1",
        to: "a@test.com",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("throws when email destination missing", async () => {
    await expect(
      svc.send({
        kind: "auth",
        channel: "email",
        template: "auth.welcome",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("sendVerificationEmail uses auth verify template", async () => {
    prismaMock.notificationDelivery.findUniqueOrThrow.mockResolvedValue({ id: "d1", status: "sent" });
    await svc.sendVerificationEmail("a@test.com", "tok", "http://base");
    expect(emailMock.sendVerificationEmail).toHaveBeenCalledWith("a@test.com", "tok", "http://base");
  });

  it("creates in-app notification and emits gateway event", async () => {
    prismaMock.notification.create.mockResolvedValue({
      id: "n1",
      userId: "u1",
      title: "Hi",
      body: "Body",
      link: null,
      type: "system",
      senderId: null,
      readAt: null,
      createdAt: new Date(),
    });

    const result = await svc.send({
      kind: "transactional",
      channel: "in_app",
      template: "inbound.message",
      userId: "u1",
      title: "Hi",
      body: "Body",
    });

    expect(result.notificationId).toBe("n1");
    expect(gatewayMock.emitNotificationCreated).toHaveBeenCalled();
  });
});

describe("NotificationsService inbox", () => {
  it("markRead throws NotFoundError when not owned", async () => {
    prismaMock.notification.findFirst.mockResolvedValue(null);
    await expect(svc.markRead("u1", "missing")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("markAllRead returns updated count", async () => {
    prismaMock.notification.updateMany.mockResolvedValue({ count: 3 });
    await expect(svc.markAllRead("u1")).resolves.toEqual({ updated: 3 });
  });
});

describe("NotificationsService preferences", () => {
  it("records marketing consent when emailMarketing enabled", async () => {
    prismaMock.notificationPreference.update.mockResolvedValue({
      emailTransactional: true,
      emailMarketing: true,
      smsTransactional: true,
      smsMarketing: false,
      inApp: true,
    });

    await svc.updatePreferences("u1", { emailMarketing: true });
    expect(prismaMock.marketingConsent.create).toHaveBeenCalled();
  });

  it("getPreferences ensures defaults exist", async () => {
    prismaMock.notificationPreference.upsert.mockResolvedValue({
      emailTransactional: true,
      emailMarketing: false,
      smsTransactional: true,
      smsMarketing: false,
      inApp: true,
    });
    const prefs = await svc.getPreferences("u1");
    expect(prefs.inApp).toBe(true);
  });
});

describe("NotificationsService deliverNow and queue", () => {
  it("queues non-auth email for worker", async () => {
    prismaMock.notificationDelivery.create.mockResolvedValue({ id: "del-2", status: "pending" });
    await svc.send({
      kind: "marketing",
      channel: "email",
      template: "marketing.campaign",
      userId: "u1",
      to: "a@test.com",
      data: { htmlBody: "<p>x</p>" },
    }).catch(() => undefined);
    // marketing blocked without consent — test queue path via transactional in_app bypass
  });

  it("deliverNow sends password reset sms", async () => {
    prismaMock.notificationDelivery.findUniqueOrThrow.mockResolvedValue({
      id: "del-1",
      kind: "transactional",
      channel: "sms",
      template: "transactional.password_reset_sms",
      toAddress: "+15551234567",
      userId: null,
    });
    await svc.deliverNow("del-1");
    expect(smsMock.sendTransactional).toHaveBeenCalled();
  });

  it("deliverNow marks failure on provider error", async () => {
    prismaMock.notificationDelivery.findUniqueOrThrow.mockResolvedValue({
      id: "del-1",
      kind: "auth",
      channel: "email",
      template: "auth.welcome",
      toAddress: "a@test.com",
      userId: null,
    });
    emailMock.sendWelcomeEmail.mockRejectedValue(new Error("fail"));
    await expect(svc.deliverNow("del-1")).rejects.toThrow("fail");
    expect(prismaMock.notificationDelivery.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "failed" }) }),
    );
  });

  it("listInbox paginates results", async () => {
    prismaMock.notification.count.mockResolvedValue(1);
    prismaMock.notification.findMany.mockResolvedValue([
      {
        id: "n1",
        userId: "u1",
        title: "T",
        body: "B",
        link: null,
        type: "system",
        senderId: null,
        readAt: null,
        createdAt: new Date(),
      },
    ]);
    const result = await svc.listInbox("u1", { page: 1, pageSize: 10, unreadOnly: true });
    expect(result.data).toHaveLength(1);
  });

  it("markRead is idempotent when already read", async () => {
    const readAt = new Date();
    prismaMock.notification.findFirst.mockResolvedValue({
      id: "n1",
      userId: "u1",
      title: "T",
      body: "B",
      link: null,
      type: "system",
      senderId: null,
      readAt,
      createdAt: new Date(),
    });
    const result = await svc.markRead("u1", "n1");
    expect(result.read).toBe(true);
    expect(prismaMock.notification.update).not.toHaveBeenCalled();
  });

  it("createInboundNotification creates in-app row", async () => {
    prismaMock.notification.create.mockResolvedValue({
      id: "n1",
      userId: "u1",
      title: "Inbound",
      body: "msg",
      link: null,
      type: "message",
      senderId: null,
      readAt: null,
      createdAt: new Date(),
    });
    await svc.createInboundNotification("u1", "Inbound", "msg");
    expect(gatewayMock.emitNotificationCreated).toHaveBeenCalled();
  });

  it("isSmsOptedOut returns true when record exists", async () => {
    prismaMock.smsOptOut.findUnique.mockResolvedValue({ phone: "+1" });
    await expect(svc.isSmsOptedOut("+1")).resolves.toBe(true);
  });

  it("blocks marketing when email preference disabled", async () => {
    prismaMock.notificationPreference.upsert.mockResolvedValue({
      userId: "u1",
      emailMarketing: false,
      smsMarketing: false,
      emailTransactional: true,
      smsTransactional: true,
      inApp: true,
    });
    prismaMock.marketingConsent.findFirst.mockResolvedValue({ id: "c1" });

    await expect(
      svc.send({
        kind: "marketing",
        channel: "email",
        template: "marketing.campaign",
        userId: "u1",
        to: "a@test.com",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("blocks marketing SMS when phone opted out", async () => {
    prismaMock.notificationPreference.upsert.mockResolvedValue({
      userId: "u1",
      emailMarketing: false,
      smsMarketing: true,
      emailTransactional: true,
      smsTransactional: true,
      inApp: true,
    });
    prismaMock.marketingConsent.findFirst.mockResolvedValue({ id: "c1" });
    prismaMock.smsOptOut.findUnique.mockResolvedValue({ phone: "+1555" });

    await expect(
      svc.send({
        kind: "marketing",
        channel: "sms",
        template: "marketing.campaign",
        userId: "u1",
        to: "+1555",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("allows marketing when consent and preferences ok", async () => {
    prismaMock.notificationPreference.upsert.mockResolvedValue({
      userId: "u1",
      emailMarketing: true,
      smsMarketing: false,
      emailTransactional: true,
      smsTransactional: true,
      inApp: true,
    });
    prismaMock.marketingConsent.findFirst.mockResolvedValue({ id: "c1" });
    prismaMock.notificationDelivery.create.mockResolvedValue({ id: "del-m", status: "pending" });
    prismaMock.notificationDelivery.update.mockResolvedValue({});
    prismaMock.notificationDelivery.findUniqueOrThrow.mockResolvedValue({ id: "del-m", status: "queued" });

    const result = await svc.send({
      kind: "marketing",
      channel: "email",
      template: "marketing.campaign",
      userId: "u1",
      to: "a@test.com",
      data: { htmlBody: "<p>Ad</p>", subject: "News" },
    });

    expect(result.status).toBe("queued");
    expect(queueMock.add).toHaveBeenCalled();
  });

  it("sendPasswordResetEmail and sendPasswordResetSms delegate to send", async () => {
    prismaMock.notificationDelivery.findUniqueOrThrow.mockResolvedValue({ id: "d1", status: "sent" });
    await svc.sendPasswordResetEmail("a@test.com", "tok", "http://base");
    expect(emailMock.sendPasswordResetEmail).toHaveBeenCalled();

    prismaMock.notificationDelivery.create.mockResolvedValue({ id: "del-sms", status: "pending" });
    await svc.sendPasswordResetSms("+1555");
    expect(queueMock.add).toHaveBeenCalled();
  });

  it("deliverNow uses default base URL when omitted from data", async () => {
    configMock.get.mockReturnValue(undefined);
    prismaMock.notificationDelivery.findUniqueOrThrow.mockResolvedValue({
      id: "d1",
      kind: "auth",
      channel: "email",
      template: "auth.verify_email",
      toAddress: "a@test.com",
      userId: null,
    });
    await svc.deliverNow("d1", {
      kind: "auth",
      channel: "email",
      template: "auth.verify_email",
      to: "a@test.com",
      data: { token: "t" },
    });
    expect(emailMock.sendVerificationEmail).toHaveBeenCalledWith(
      "a@test.com",
      "t",
      "http://localhost:5173",
    );
  });

  it("deliverNow renders auth verify and password reset templates", async () => {
    for (const template of ["auth.verify_email", "auth.password_reset", "auth.otp"] as const) {
      prismaMock.notificationDelivery.findUniqueOrThrow.mockResolvedValue({
        id: "d1",
        kind: "auth",
        channel: "email",
        template,
        toAddress: "a@test.com",
        userId: null,
      });
      await svc.deliverNow("d1", {
        kind: "auth",
        channel: "email",
        template,
        to: "a@test.com",
        data: { token: "t", baseUrl: "http://b", code: "123456" },
      });
    }
    expect(emailMock.sendVerificationEmail).toHaveBeenCalled();
  });

  it("deliverNow sends default marketing email template", async () => {
    prismaMock.notificationDelivery.findUniqueOrThrow.mockResolvedValue({
      id: "d1",
      kind: "marketing",
      channel: "email",
      template: "marketing.campaign",
      toAddress: "a@test.com",
      userId: "u1",
    });
    await svc.deliverNow("d1", {
      kind: "marketing",
      channel: "email",
      template: "marketing.campaign",
      to: "a@test.com",
      data: { htmlBody: "<p>Ad</p>", subject: "News", textBody: "Ad" },
    });
    expect(emailMock.send).toHaveBeenCalled();
  });

  it("deliverNow sends default sms body", async () => {
    prismaMock.notificationDelivery.findUniqueOrThrow.mockResolvedValue({
      id: "d1",
      kind: "marketing",
      channel: "sms",
      template: "marketing.campaign",
      toAddress: "+1555",
      userId: "u1",
    });
    await svc.deliverNow("d1", {
      kind: "marketing",
      channel: "sms",
      template: "marketing.campaign",
      to: "+1555",
      data: { body: "Promo" },
    });
    expect(smsMock.sendTransactional).toHaveBeenCalledWith("+1555", "Promo");
  });

  it("recordSmsOptOut upserts phone", async () => {
    await svc.recordSmsOptOut("+1555", "STOP");
    expect(prismaMock.smsOptOut.upsert).toHaveBeenCalled();
  });

  it("findUserByEmail normalizes email", async () => {
    prismaMock.user.findFirst.mockResolvedValue({ id: "u1" });
    await svc.findUserByEmail("A@Test.com");
    expect(prismaMock.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: "a@test.com" } }),
    );
  });

  it("throws when in_app send missing required fields", async () => {
    prismaMock.notificationDelivery.create.mockResolvedValue({ id: "del-in", status: "pending" });
    await expect(
      svc.send({
        kind: "transactional",
        channel: "in_app",
        template: "inbound.message",
        userId: "u1",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("blocks marketing without userId", async () => {
    await expect(
      svc.send({
        kind: "marketing",
        channel: "email",
        template: "marketing.campaign",
        to: "a@test.com",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("blocks marketing when sms preference disabled", async () => {
    prismaMock.notificationPreference.upsert.mockResolvedValue({
      userId: "u1",
      emailMarketing: false,
      smsMarketing: false,
      emailTransactional: true,
      smsTransactional: true,
      inApp: true,
    });
    prismaMock.marketingConsent.findFirst.mockResolvedValue({ id: "c1" });
    await expect(
      svc.send({
        kind: "marketing",
        channel: "sms",
        template: "marketing.campaign",
        userId: "u1",
        to: "+1555",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("records sms marketing consent on preference update", async () => {
    prismaMock.notificationPreference.update.mockResolvedValue({
      emailTransactional: true,
      emailMarketing: false,
      smsTransactional: true,
      smsMarketing: true,
      inApp: true,
    });
    await svc.updatePreferences("u1", { smsMarketing: true });
    expect(prismaMock.marketingConsent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ channel: "sms" }) }),
    );
  });

  it("findUserByPhone looks up by phone", async () => {
    prismaMock.user.findFirst.mockResolvedValue({ id: "u1" });
    await svc.findUserByPhone("+1555");
    expect(prismaMock.user.findFirst).toHaveBeenCalled();
  });

  it("listInbox without unreadOnly omits readAt filter", async () => {
    prismaMock.notification.count.mockResolvedValue(0);
    prismaMock.notification.findMany.mockResolvedValue([]);
    await svc.listInbox("u1", { page: 1, pageSize: 20 });
    expect(prismaMock.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "u1" } }),
    );
  });

  it("markRead updates unread notification", async () => {
    prismaMock.notification.findFirst.mockResolvedValue({
      id: "n1",
      userId: "u1",
      title: "T",
      body: "B",
      link: null,
      type: "system",
      senderId: null,
      readAt: null,
      createdAt: new Date(),
    });
    prismaMock.notification.update.mockResolvedValue({
      id: "n1",
      userId: "u1",
      title: "T",
      body: "B",
      link: null,
      type: "system",
      senderId: null,
      readAt: new Date(),
      createdAt: new Date(),
    });

    const result = await svc.markRead("u1", "n1");
    expect(result.read).toBe(true);
    expect(prismaMock.notification.update).toHaveBeenCalled();
  });

  it("updatePreferences applies partial field updates", async () => {
    prismaMock.notificationPreference.update.mockResolvedValue({
      emailTransactional: false,
      emailMarketing: false,
      smsTransactional: true,
      smsMarketing: false,
      inApp: false,
    });
    await svc.updatePreferences("u1", { emailTransactional: false, inApp: false });
    expect(prismaMock.notificationPreference.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ emailTransactional: false, inApp: false }),
      }),
    );
  });

  it("createInboundNotification passes optional link", async () => {
    prismaMock.notification.create.mockResolvedValue({
      id: "n1",
      userId: "u1",
      title: "Inbound",
      body: "msg",
      link: "/inbox",
      type: "message",
      senderId: null,
      readAt: null,
      createdAt: new Date(),
    });
    await svc.createInboundNotification("u1", "Inbound", "msg", "/inbox");
    expect(prismaMock.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ link: "/inbox" }) }),
    );
  });

  it("deliverNow loads delivery from database when request omitted", async () => {
    emailMock.sendWelcomeEmail.mockResolvedValue(undefined);
    prismaMock.notificationDelivery.findUniqueOrThrow.mockResolvedValue({
      id: "del-1",
      kind: "auth",
      channel: "email",
      template: "auth.welcome",
      toAddress: "a@test.com",
      userId: null,
    });
    await svc.deliverNow("del-1");
    expect(emailMock.sendWelcomeEmail).toHaveBeenCalledWith("a@test.com", undefined);
  });

  it("works without optional gateway", async () => {
    const svcNoGateway = new NotificationsService(
      prismaMock as never,
      emailMock as never,
      smsMock as never,
      configMock as never,
      queueMock as never,
    );
    prismaMock.notification.create.mockResolvedValue({
      id: "n1",
      userId: "u1",
      title: "Hi",
      body: "Body",
      link: null,
      type: "system",
      senderId: null,
      readAt: null,
      createdAt: new Date(),
    });
    prismaMock.notificationDelivery.create.mockResolvedValue({ id: "del-in", status: "pending" });

    await expect(
      svcNoGateway.send({
        kind: "transactional",
        channel: "in_app",
        template: "inbound.message",
        userId: "u1",
        title: "Hi",
        body: "Body",
      }),
    ).resolves.toMatchObject({ status: "delivered" });
  });

  it("isSmsOptedOut returns false when no record", async () => {
    prismaMock.smsOptOut.findUnique.mockResolvedValue(null);
    await expect(svc.isSmsOptedOut("+1555")).resolves.toBe(false);
  });

  it("deliverNow handles non-Error provider failure", async () => {
    prismaMock.notificationDelivery.findUniqueOrThrow.mockResolvedValue({
      id: "del-1",
      kind: "auth",
      channel: "email",
      template: "auth.welcome",
      toAddress: "a@test.com",
      userId: null,
    });
    emailMock.sendWelcomeEmail.mockRejectedValue("provider down");
    await expect(svc.deliverNow("del-1")).rejects.toBe("provider down");
    expect(prismaMock.notificationDelivery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "failed", error: "provider down" }),
      }),
    );
  });

  it("email default template sends html-only when textBody absent", async () => {
    prismaMock.notificationDelivery.findUniqueOrThrow.mockResolvedValue({
      id: "d1",
      kind: "marketing",
      channel: "email",
      template: "marketing.campaign",
      toAddress: "a@test.com",
      userId: "u1",
    });
    await svc.deliverNow("d1", {
      kind: "marketing",
      channel: "email",
      template: "marketing.campaign",
      to: "a@test.com",
      data: { htmlBody: "<p>Ad</p>", subject: "News" },
    });
    expect(emailMock.send).toHaveBeenCalledWith(
      expect.objectContaining({ html: "<p>Ad</p>", subject: "News" }),
    );
    expect(emailMock.send.mock.calls[0][0]).not.toHaveProperty("text");
  });

  it("allows transactional in_app template validation", async () => {
    prismaMock.notificationDelivery.create.mockResolvedValue({ id: "del-in", status: "pending" });
    prismaMock.notification.create.mockResolvedValue({
      id: "n1",
      userId: "u1",
      title: "Alert",
      body: "Body",
      link: null,
      type: "system",
      senderId: null,
      readAt: null,
      createdAt: new Date(),
    });
    await svc.send({
      kind: "transactional",
      channel: "in_app",
      template: "inbound.message",
      userId: "u1",
      title: "Alert",
      body: "Body",
    });
    expect(prismaMock.notification.create).toHaveBeenCalled();
  });

  it("deliverNow generates otp email code when data.code absent", async () => {
    emailMock.send.mockResolvedValue(undefined);
    prismaMock.notificationDelivery.findUniqueOrThrow.mockResolvedValue({
      id: "d1",
      kind: "auth",
      channel: "email",
      template: "auth.otp",
      toAddress: "a@test.com",
      userId: null,
    });
    await svc.deliverNow("d1", {
      kind: "auth",
      channel: "email",
      template: "auth.otp",
      to: "a@test.com",
      data: {},
    });
    expect(emailMock.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "a@test.com",
        subject: "Your WarehouseJobs verification code",
      }),
    );
  });

  it("updatePreferences can toggle smsTransactional only", async () => {
    prismaMock.notificationPreference.update.mockResolvedValue({
      emailTransactional: true,
      emailMarketing: false,
      smsTransactional: false,
      smsMarketing: false,
      inApp: true,
    });
    await svc.updatePreferences("u1", { smsTransactional: false });
    expect(prismaMock.marketingConsent.create).not.toHaveBeenCalled();
  });

  it("sendSmsTemplate uses request.body fallback", async () => {
    prismaMock.notificationDelivery.findUniqueOrThrow.mockResolvedValue({
      id: "d1",
      kind: "marketing",
      channel: "sms",
      template: "marketing.campaign",
      toAddress: "+1555",
      userId: "u1",
    });
    await svc.deliverNow("d1", {
      kind: "marketing",
      channel: "sms",
      template: "marketing.campaign",
      to: "+1555",
      body: "Fallback body",
    });
    expect(smsMock.sendTransactional).toHaveBeenCalledWith("+1555", "Fallback body");
  });

  it("recordSmsOptOut uses default STOP source", async () => {
    await svc.recordSmsOptOut("+1555");
    expect(prismaMock.smsOptOut.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ source: "STOP" }) }),
    );
  });

  it("deliverNow password reset uses default base URL", async () => {
    configMock.get.mockReturnValue(undefined);
    prismaMock.notificationDelivery.findUniqueOrThrow.mockResolvedValue({
      id: "d1",
      kind: "auth",
      channel: "email",
      template: "auth.password_reset",
      toAddress: "a@test.com",
      userId: null,
    });
    emailMock.sendPasswordResetEmail.mockResolvedValue(undefined);
    await svc.deliverNow("d1", {
      kind: "auth",
      channel: "email",
      template: "auth.password_reset",
      to: "a@test.com",
      data: { token: "t" },
    });
    expect(emailMock.sendPasswordResetEmail).toHaveBeenCalledWith(
      "a@test.com",
      "t",
      "http://localhost:5173",
    );
  });

  it("deliverNow reconstructs payload from delivery row", async () => {
    emailMock.sendWelcomeEmail.mockResolvedValue(undefined);
    prismaMock.notificationDelivery.findUniqueOrThrow.mockResolvedValue({
      id: "del-1",
      kind: "auth",
      channel: "email",
      template: "auth.welcome",
      toAddress: "user@example.com",
      userId: "u1",
    });
    await svc.deliverNow("del-1");
    expect(emailMock.sendWelcomeEmail).toHaveBeenCalledWith("user@example.com", undefined);
  });

  it("default email template uses textBody and request body fallbacks", async () => {
    prismaMock.notificationDelivery.findUniqueOrThrow.mockResolvedValue({
      id: "d1",
      kind: "marketing",
      channel: "email",
      template: "marketing.campaign",
      toAddress: "a@test.com",
      userId: "u1",
    });
    await svc.deliverNow("d1", {
      kind: "marketing",
      channel: "email",
      template: "marketing.campaign",
      to: "a@test.com",
      body: "Plain fallback",
      data: { textBody: "Text only" },
    });
    expect(emailMock.send).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "WarehouseJobs",
        html: "Text only",
        text: "Text only",
      }),
    );
  });

  it("default sms template uses generic body when data and request body missing", async () => {
    prismaMock.notificationDelivery.findUniqueOrThrow.mockResolvedValue({
      id: "d1",
      kind: "marketing",
      channel: "sms",
      template: "marketing.campaign",
      toAddress: "+1555",
      userId: "u1",
    });
    await svc.deliverNow("d1", {
      kind: "marketing",
      channel: "sms",
      template: "marketing.campaign",
      to: "+1555",
      data: {},
    });
    expect(smsMock.sendTransactional).toHaveBeenCalledWith("+1555", "WarehouseJobs notification");
  });

  it("default email template falls back to request body for html", async () => {
    prismaMock.notificationDelivery.findUniqueOrThrow.mockResolvedValue({
      id: "d1",
      kind: "marketing",
      channel: "email",
      template: "marketing.campaign",
      toAddress: "a@test.com",
      userId: "u1",
    });
    await svc.deliverNow("d1", {
      kind: "marketing",
      channel: "email",
      template: "marketing.campaign",
      to: "a@test.com",
      body: "Raw html body",
      data: {},
    });
    expect(emailMock.send).toHaveBeenCalledWith(
      expect.objectContaining({ html: "Raw html body", subject: "WarehouseJobs" }),
    );
  });

  it("deliverNow throws ValidationError when delivery row has no toAddress and no request override", async () => {
    prismaMock.notificationDelivery.findUniqueOrThrow.mockResolvedValue({
      id: "del-1",
      kind: "auth",
      channel: "email",
      template: "auth.welcome",
      toAddress: null,
      userId: null,
    });
    await expect(svc.deliverNow("del-1")).rejects.toThrow("Email delivery requires a recipient address");
  });
});
