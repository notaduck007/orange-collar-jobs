import { NotificationWorker } from "@domains/notifications/notification.worker";

const notificationsMock = { deliverNow: jest.fn(), send: jest.fn() };
const prismaMock = {
  notificationCampaign: { findUniqueOrThrow: jest.fn(), update: jest.fn() },
  user: { findUnique: jest.fn() },
  notificationDelivery: { create: jest.fn() },
};

let worker: NotificationWorker;

beforeEach(() => {
  jest.clearAllMocks();
  worker = new NotificationWorker(notificationsMock as never, prismaMock as never);
});

describe("NotificationWorker", () => {
  it("delivers queued notification jobs", async () => {
    await worker.handleDeliver({
      data: { deliveryId: "d1" },
      attemptsMade: 0,
    } as never);
    expect(notificationsMock.deliverNow).toHaveBeenCalledWith("d1");
  });

  it("rethrows after max delivery attempts", async () => {
    notificationsMock.deliverNow.mockRejectedValue(new Error("provider down"));
    await expect(
      worker.handleDeliver({ data: { deliveryId: "d1" }, attemptsMade: 2 } as never),
    ).rejects.toThrow("provider down");
  });

  it("processes campaign-send jobs", async () => {
    prismaMock.notificationCampaign.findUniqueOrThrow.mockResolvedValue({
      id: "c1",
      channel: "email",
      subject: "Hi",
      htmlBody: "<p>Hi</p>",
      textBody: null,
    });
    prismaMock.user.findUnique.mockResolvedValue({ id: "u1", email: "a@test.com", phone: null });
    notificationsMock.send.mockResolvedValue({ deliveryId: "d1", status: "queued" });
    prismaMock.notificationCampaign.update.mockResolvedValue({});

    await worker.handleCampaignSend({
      data: { campaignId: "c1", userIds: ["u1"], offset: 0 },
    } as never);

    expect(notificationsMock.send).toHaveBeenCalled();
    expect(prismaMock.notificationCampaign.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "sent" }) }),
    );
  });

  it("records skipped delivery when marketing send blocked", async () => {
    prismaMock.notificationCampaign.findUniqueOrThrow.mockResolvedValue({
      id: "c1",
      channel: "email",
      subject: "Hi",
      htmlBody: "<p>Hi</p>",
      textBody: null,
    });
    prismaMock.user.findUnique.mockResolvedValue({ id: "u1", email: "a@test.com", phone: null });
    notificationsMock.send.mockRejectedValue(new Error("blocked"));
    prismaMock.notificationCampaign.update.mockResolvedValue({});

    await worker.handleCampaignSend({
      data: { campaignId: "c1", userIds: ["u1"], offset: 0 },
    } as never);

    expect(prismaMock.notificationDelivery.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "skipped" }) }),
    );
  });

  it("skips users without email on email campaign", async () => {
    prismaMock.notificationCampaign.findUniqueOrThrow.mockResolvedValue({
      id: "c1",
      channel: "email",
      subject: "Hi",
      htmlBody: "<p>Hi</p>",
      textBody: null,
    });
    prismaMock.user.findUnique.mockResolvedValue({ id: "u1", email: null, phone: null });
    prismaMock.notificationCampaign.update.mockResolvedValue({});

    await worker.handleCampaignSend({
      data: { campaignId: "c1", userIds: ["u1"], offset: 0 },
    } as never);

    expect(notificationsMock.send).not.toHaveBeenCalled();
  });

  it("skips missing users in campaign chunk", async () => {
    prismaMock.notificationCampaign.findUniqueOrThrow.mockResolvedValue({
      id: "c1",
      channel: "email",
      subject: "Hi",
      htmlBody: "<p>Hi</p>",
      textBody: null,
    });
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.notificationCampaign.update.mockResolvedValue({});

    await worker.handleCampaignSend({
      data: { campaignId: "c1", userIds: ["missing"], offset: 0 },
    } as never);

    expect(notificationsMock.send).not.toHaveBeenCalled();
  });

  it("rethrows deliver error before max attempts", async () => {
    notificationsMock.deliverNow.mockRejectedValue(new Error("transient"));
    await expect(
      worker.handleDeliver({ data: { deliveryId: "d1" }, attemptsMade: 0 } as never),
    ).rejects.toThrow("transient");
  });

  it("processes sms campaign-send jobs", async () => {
    prismaMock.notificationCampaign.findUniqueOrThrow.mockResolvedValue({
      id: "c1",
      channel: "sms",
      subject: null,
      htmlBody: null,
      textBody: "Promo",
    });
    prismaMock.user.findUnique.mockResolvedValue({ id: "u1", email: null, phone: "+1555" });
    notificationsMock.send.mockResolvedValue({ deliveryId: "d1", status: "queued" });
    prismaMock.notificationCampaign.update.mockResolvedValue({});

    await worker.handleCampaignSend({
      data: { campaignId: "c1", userIds: ["u1"], offset: 0 },
    } as never);

    expect(notificationsMock.send).toHaveBeenCalledWith(
      expect.objectContaining({ channel: "sms", to: "+1555" }),
    );
  });

  it("skips users without phone on sms campaign", async () => {
    prismaMock.notificationCampaign.findUniqueOrThrow.mockResolvedValue({
      id: "c1",
      channel: "sms",
      subject: null,
      htmlBody: null,
      textBody: "Promo",
    });
    prismaMock.user.findUnique.mockResolvedValue({ id: "u1", email: "a@test.com", phone: null });
    prismaMock.notificationCampaign.update.mockResolvedValue({});

    await worker.handleCampaignSend({
      data: { campaignId: "c1", userIds: ["u1"], offset: 0 },
    } as never);

    expect(notificationsMock.send).not.toHaveBeenCalled();
  });

  it("records skipped delivery when send throws non-Error", async () => {
    prismaMock.notificationCampaign.findUniqueOrThrow.mockResolvedValue({
      id: "c1",
      channel: "email",
      subject: "Hi",
      htmlBody: "<p>Hi</p>",
      textBody: null,
    });
    prismaMock.user.findUnique.mockResolvedValue({ id: "u1", email: "a@test.com", phone: null });
    notificationsMock.send.mockRejectedValue("blocked");
    prismaMock.notificationCampaign.update.mockResolvedValue({});

    await worker.handleCampaignSend({
      data: { campaignId: "c1", userIds: ["u1"], offset: 0 },
    } as never);

    expect(prismaMock.notificationDelivery.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "skipped", error: "blocked" }),
      }),
    );
  });
});
