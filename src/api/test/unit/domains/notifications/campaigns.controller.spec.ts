import { CampaignsController } from "@domains/notifications/campaigns.controller";
import type { AuthUser } from "@core/auth/jwt.strategy";

const svcMock = {
  create: jest.fn(),
  list: jest.fn(),
  get: jest.fn(),
  send: jest.fn(),
  stats: jest.fn(),
};

const admin: AuthUser = { id: "admin-1", email: "admin@test.com", role: "admin" };

let ctrl: CampaignsController;

beforeEach(() => {
  jest.clearAllMocks();
  ctrl = new CampaignsController(svcMock as never);
});

describe("CampaignsController", () => {
  it("create delegates", async () => {
    svcMock.create.mockResolvedValue({ id: "c1" });
    await ctrl.create({ name: "X", channel: "email" }, admin);
    expect(svcMock.create).toHaveBeenCalledWith({ name: "X", channel: "email" }, "admin-1");
  });

  it("list delegates", async () => {
    svcMock.list.mockResolvedValue({ data: [] });
    await ctrl.list({ page: 1 });
    expect(svcMock.list).toHaveBeenCalled();
  });

  it("get delegates", async () => {
    svcMock.get.mockResolvedValue({ id: "c1" });
    await ctrl.get("c1");
    expect(svcMock.get).toHaveBeenCalledWith("c1");
  });

  it("send delegates", async () => {
    svcMock.send.mockResolvedValue({ id: "c1", status: "sending" });
    await ctrl.send("c1", admin);
    expect(svcMock.send).toHaveBeenCalledWith("c1", "admin-1");
  });

  it("stats delegates", async () => {
    svcMock.stats.mockResolvedValue({ campaignId: "c1", targeted: 0, sent: 0, delivered: 0, bounced: 0, optedOut: 0, failed: 0 });
    await ctrl.stats("c1");
    expect(svcMock.stats).toHaveBeenCalledWith("c1");
  });
});
