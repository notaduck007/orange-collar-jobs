import { NotFoundError, ValidationError } from "@core/error/errors";
import { CampaignService } from "@domains/notifications/campaign.service";

const prismaMock = {
  notificationCampaign: {
    create: jest.fn(),
    count: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    findUniqueOrThrow: jest.fn(),
  },
  user: { findMany: jest.fn() },
  notificationPreference: { findUnique: jest.fn() },
  marketingConsent: { findFirst: jest.fn() },
  notificationDelivery: { findMany: jest.fn() },
};

const notificationsMock = { isSmsOptedOut: jest.fn().mockResolvedValue(false) };
const queueMock = { add: jest.fn() };

let svc: CampaignService;

beforeEach(() => {
  jest.clearAllMocks();
  svc = new CampaignService(prismaMock as never, notificationsMock as never, queueMock as never);
});

describe("CampaignService", () => {
  it("creates a draft campaign", async () => {
    prismaMock.notificationCampaign.create.mockResolvedValue({
      id: "c1",
      name: "Spring",
      channel: "email",
      status: "draft",
      segment: {},
      subject: "Hi",
      htmlBody: "<p>Hi</p>",
      textBody: null,
      scheduledAt: null,
      sentAt: null,
      createdAt: new Date(),
    });

    const result = await svc.create({ name: "Spring", channel: "email" }, "admin-1");
    expect(result.id).toBe("c1");
  });

  it("get normalizes null segment to empty object", async () => {
    prismaMock.notificationCampaign.findUnique.mockResolvedValue({
      id: "c1",
      name: "X",
      channel: "email",
      status: "draft",
      segment: null,
      subject: null,
      htmlBody: null,
      textBody: null,
      scheduledAt: null,
      sentAt: null,
      createdAt: new Date(),
    });
    const result = await svc.get("c1");
    expect(result.segment).toEqual({});
  });

  it("send throws when no recipients", async () => {
    prismaMock.notificationCampaign.findUnique.mockResolvedValue({
      id: "c1",
      channel: "email",
      segment: {},
      htmlBody: "<p>x</p>",
      status: "draft",
    });
    prismaMock.user.findMany.mockResolvedValue([]);

    await expect(svc.send("c1", "admin-1")).rejects.toBeInstanceOf(ValidationError);
  });

  it("stats aggregates delivery rows", async () => {
    prismaMock.notificationCampaign.findUnique.mockResolvedValue({ id: "c1" });
    prismaMock.notificationDelivery.findMany.mockResolvedValue([
      { status: "sent" },
      { status: "failed" },
      { status: "skipped" },
    ]);

    const stats = await svc.stats("c1");
    expect(stats.targeted).toBe(3);
    expect(stats.failed).toBe(1);
    expect(stats.optedOut).toBe(1);
  });

  it("get throws NotFoundError", async () => {
    prismaMock.notificationCampaign.findUnique.mockResolvedValue(null);
    await expect(svc.get("missing")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("list returns paginated campaigns", async () => {
    prismaMock.notificationCampaign.count.mockResolvedValue(1);
    prismaMock.notificationCampaign.findMany.mockResolvedValue([
      {
        id: "c1",
        name: "X",
        channel: "email",
        status: "draft",
        segment: {},
        subject: null,
        htmlBody: null,
        textBody: null,
        scheduledAt: null,
        sentAt: null,
        createdAt: new Date(),
      },
    ]);
    const result = await svc.list({ page: 1, pageSize: 10 });
    expect(result.data).toHaveLength(1);
  });

  it("send throws when campaign already sent", async () => {
    prismaMock.notificationCampaign.findUnique.mockResolvedValue({
      id: "c1",
      channel: "email",
      segment: {},
      htmlBody: "<p>x</p>",
      status: "sent",
    });
    await expect(svc.send("c1", "admin-1")).rejects.toBeInstanceOf(ValidationError);
  });

  it("send throws when email template missing", async () => {
    prismaMock.notificationCampaign.findUnique.mockResolvedValue({
      id: "c1",
      channel: "email",
      segment: {},
      htmlBody: null,
      textBody: null,
      status: "draft",
    });
    prismaMock.user.findMany.mockResolvedValue([{ id: "u1", email: "a@test.com", phone: null }]);
    prismaMock.notificationPreference.findUnique.mockResolvedValue({ emailMarketing: true });
    prismaMock.marketingConsent.findFirst.mockResolvedValue({ id: "mc" });
    await expect(svc.send("c1", "admin-1")).rejects.toBeInstanceOf(ValidationError);
  });

  it("send queues campaign when recipients exist", async () => {
    prismaMock.notificationCampaign.findUnique.mockResolvedValue({
      id: "c1",
      channel: "email",
      segment: { role: "seeker" },
      htmlBody: "<p>Hi</p>",
      status: "draft",
    });
    prismaMock.user.findMany.mockResolvedValue([
      { id: "u1", email: "a@test.com", phone: null },
    ]);
    prismaMock.notificationPreference.findUnique.mockResolvedValue({
      emailMarketing: true,
    });
    prismaMock.marketingConsent.findFirst.mockResolvedValue({ id: "mc-1" });
    prismaMock.notificationCampaign.findUniqueOrThrow.mockResolvedValue({
      id: "c1",
      name: "X",
      channel: "email",
      status: "sending",
      segment: {},
      subject: "S",
      htmlBody: "<p>Hi</p>",
      textBody: null,
      scheduledAt: null,
      sentAt: null,
      createdAt: new Date(),
    });

    await svc.send("c1", "admin-1");
    expect(queueMock.add).toHaveBeenCalled();
  });

  it("send with sms channel resolves phone recipients", async () => {
    prismaMock.notificationCampaign.findUnique.mockResolvedValue({
      id: "c1",
      channel: "sms",
      segment: {},
      textBody: "Promo",
      status: "draft",
    });
    prismaMock.user.findMany.mockResolvedValue([
      { id: "u1", email: "a@test.com", phone: "+15551234567" },
    ]);
    prismaMock.notificationPreference.findUnique.mockResolvedValue({ smsMarketing: true });
    prismaMock.marketingConsent.findFirst.mockResolvedValue({ id: "mc" });
    notificationsMock.isSmsOptedOut.mockResolvedValue(false);
    prismaMock.notificationCampaign.findUniqueOrThrow.mockResolvedValue({
      id: "c1",
      name: "SMS",
      channel: "sms",
      status: "sending",
      segment: {},
      subject: null,
      htmlBody: null,
      textBody: "Promo",
      scheduledAt: null,
      sentAt: null,
      createdAt: new Date(),
    });

    await svc.send("c1", "admin-1");
    expect(queueMock.add).toHaveBeenCalled();
  });

  it("list filters by status", async () => {
    prismaMock.notificationCampaign.count.mockResolvedValue(0);
    prismaMock.notificationCampaign.findMany.mockResolvedValue([]);
    await svc.list({ status: "draft", page: 1, pageSize: 10 });
    expect(prismaMock.notificationCampaign.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "draft" } }),
    );
  });

  it("creates scheduled campaign when scheduledAt provided", async () => {
    const scheduledAt = "2026-07-01T12:00:00.000Z";
    prismaMock.notificationCampaign.create.mockResolvedValue({
      id: "c-sched",
      name: "Future",
      channel: "email",
      status: "scheduled",
      segment: {},
      subject: null,
      htmlBody: null,
      textBody: null,
      scheduledAt: new Date(scheduledAt),
      sentAt: null,
      createdAt: new Date(),
    });

    const result = await svc.create(
      { name: "Future", channel: "email", scheduledAt },
      "admin-1",
    );

    expect(prismaMock.notificationCampaign.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "scheduled",
          scheduledAt: new Date(scheduledAt),
        }),
      }),
    );
    expect(result.status).toBe("scheduled");
  });

  it("send throws when campaign status is sending", async () => {
    prismaMock.notificationCampaign.findUnique.mockResolvedValue({
      id: "c1",
      channel: "email",
      segment: {},
      htmlBody: "<p>x</p>",
      status: "sending",
    });

    await expect(svc.send("c1", "admin-1")).rejects.toBeInstanceOf(ValidationError);
  });

  it("send throws NotFoundError when campaign missing", async () => {
    prismaMock.notificationCampaign.findUnique.mockResolvedValue(null);
    await expect(svc.send("missing", "admin-1")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("stats counts delivered and bounced deliveries", async () => {
    prismaMock.notificationCampaign.findUnique.mockResolvedValue({ id: "c1" });
    prismaMock.notificationDelivery.findMany.mockResolvedValue([
      { status: "delivered" },
      { status: "bounced" },
      { status: "sent" },
    ]);

    const stats = await svc.stats("c1");
    expect(stats.delivered).toBe(1);
    expect(stats.bounced).toBe(1);
    expect(stats.sent).toBe(2);
    expect(stats.targeted).toBe(3);
  });

  it("resolveSegment skips sms opt-out recipients", async () => {
    prismaMock.notificationCampaign.findUnique.mockResolvedValue({
      id: "c1",
      channel: "sms",
      segment: {},
      textBody: "Promo",
      status: "draft",
    });
    prismaMock.user.findMany.mockResolvedValue([
      { id: "u1", email: "a@test.com", phone: "+15551234567" },
    ]);
    prismaMock.notificationPreference.findUnique.mockResolvedValue({ smsMarketing: true });
    prismaMock.marketingConsent.findFirst.mockResolvedValue({ id: "mc" });
    notificationsMock.isSmsOptedOut.mockResolvedValue(true);

    await expect(svc.send("c1", "admin-1")).rejects.toBeInstanceOf(ValidationError);
    expect(notificationsMock.isSmsOptedOut).toHaveBeenCalledWith("+15551234567");
  });

  it("resolveSegment skips sms users without phone", async () => {
    prismaMock.notificationCampaign.findUnique.mockResolvedValue({
      id: "c1",
      channel: "sms",
      segment: {},
      textBody: "Promo",
      status: "draft",
    });
    prismaMock.user.findMany.mockResolvedValue([
      { id: "u1", email: "a@test.com", phone: null },
    ]);
    prismaMock.notificationPreference.findUnique.mockResolvedValue({ smsMarketing: true });
    prismaMock.marketingConsent.findFirst.mockResolvedValue({ id: "mc" });

    await expect(svc.send("c1", "admin-1")).rejects.toBeInstanceOf(ValidationError);
  });

  it("resolveSegment skips users without marketing consent", async () => {
    prismaMock.notificationCampaign.findUnique.mockResolvedValue({
      id: "c1",
      channel: "email",
      segment: {},
      htmlBody: "<p>Hi</p>",
      status: "draft",
    });
    prismaMock.user.findMany.mockResolvedValue([
      { id: "u1", email: "a@test.com", phone: null },
    ]);
    prismaMock.notificationPreference.findUnique.mockResolvedValue({ emailMarketing: true });
    prismaMock.marketingConsent.findFirst.mockResolvedValue(null);

    await expect(svc.send("c1", "admin-1")).rejects.toBeInstanceOf(ValidationError);
  });

  it("resolveSegment skips users with marketing disabled", async () => {
    prismaMock.notificationCampaign.findUnique.mockResolvedValue({
      id: "c1",
      channel: "email",
      segment: {},
      htmlBody: "<p>Hi</p>",
      status: "draft",
    });
    prismaMock.user.findMany.mockResolvedValue([
      { id: "u1", email: "a@test.com", phone: null },
    ]);
    prismaMock.notificationPreference.findUnique.mockResolvedValue({ emailMarketing: false });
    prismaMock.marketingConsent.findFirst.mockResolvedValue({ id: "mc" });

    await expect(svc.send("c1", "admin-1")).rejects.toBeInstanceOf(ValidationError);
  });

  it("resolveSegment treats missing preferences as marketing disabled", async () => {
    prismaMock.notificationCampaign.findUnique.mockResolvedValue({
      id: "c1",
      channel: "email",
      segment: {},
      htmlBody: "<p>Hi</p>",
      status: "draft",
    });
    prismaMock.user.findMany.mockResolvedValue([
      { id: "u1", email: "a@test.com", phone: null },
    ]);
    prismaMock.notificationPreference.findUnique.mockResolvedValue(null);
    prismaMock.marketingConsent.findFirst.mockResolvedValue({ id: "mc" });

    await expect(svc.send("c1", "admin-1")).rejects.toBeInstanceOf(ValidationError);
  });

  it("resolveSegment handles null segment and sms marketing preference branch", async () => {
    prismaMock.notificationCampaign.findUnique.mockResolvedValue({
      id: "c1",
      channel: "sms",
      segment: null,
      textBody: "Promo",
      status: "draft",
    });
    prismaMock.user.findMany.mockResolvedValue([
      { id: "u1", email: "a@test.com", phone: "+1555" },
    ]);
    prismaMock.notificationPreference.findUnique.mockResolvedValue(null);
    prismaMock.marketingConsent.findFirst.mockResolvedValue({ id: "mc" });

    await expect(svc.send("c1", "admin-1")).rejects.toBeInstanceOf(ValidationError);
  });

  it("resolveSegment skips email users without address", async () => {
    prismaMock.notificationCampaign.findUnique.mockResolvedValue({
      id: "c1",
      channel: "email",
      segment: {},
      htmlBody: "<p>Hi</p>",
      status: "draft",
    });
    prismaMock.user.findMany.mockResolvedValue([
      { id: "u1", email: null, phone: null },
    ]);
    prismaMock.notificationPreference.findUnique.mockResolvedValue({ emailMarketing: true });
    prismaMock.marketingConsent.findFirst.mockResolvedValue({ id: "mc" });

    await expect(svc.send("c1", "admin-1")).rejects.toBeInstanceOf(ValidationError);
  });

  it("stats throws NotFoundError when campaign missing", async () => {
    prismaMock.notificationCampaign.findUnique.mockResolvedValue(null);
    await expect(svc.stats("missing")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("list without status uses empty where clause", async () => {
    prismaMock.notificationCampaign.count.mockResolvedValue(0);
    prismaMock.notificationCampaign.findMany.mockResolvedValue([]);
    await svc.list({});
    expect(prismaMock.notificationCampaign.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });
});
