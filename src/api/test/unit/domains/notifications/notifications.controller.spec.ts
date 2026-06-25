import { NotificationsController } from "@domains/notifications/notifications.controller";
import type { AuthUser } from "@core/auth/jwt.strategy";

const svcMock = {
  listInbox: jest.fn(),
  markRead: jest.fn(),
  markAllRead: jest.fn(),
  getPreferences: jest.fn(),
  updatePreferences: jest.fn(),
};

const user: AuthUser = { id: "u1", email: "a@test.com", role: "seeker" };

let ctrl: NotificationsController;

beforeEach(() => {
  jest.clearAllMocks();
  ctrl = new NotificationsController(svcMock as never);
});

describe("NotificationsController", () => {
  it("list delegates to service", async () => {
    svcMock.listInbox.mockResolvedValue({ data: [], meta: { total: 0, page: 1, pageSize: 20, totalPages: 1 } });
    await ctrl.list(user, { page: 1, pageSize: 20 });
    expect(svcMock.listInbox).toHaveBeenCalledWith("u1", { page: 1, pageSize: 20 });
  });

  it("markRead delegates to service", async () => {
    svcMock.markRead.mockResolvedValue({ id: "n1" });
    await ctrl.markRead(user, "n1");
    expect(svcMock.markRead).toHaveBeenCalledWith("u1", "n1");
  });

  it("markAllRead delegates to service", async () => {
    svcMock.markAllRead.mockResolvedValue({ updated: 2 });
    await ctrl.markAllRead(user);
    expect(svcMock.markAllRead).toHaveBeenCalledWith("u1");
  });

  it("getPreferences delegates to service", async () => {
    svcMock.getPreferences.mockResolvedValue({ inApp: true });
    await ctrl.getPreferences(user);
    expect(svcMock.getPreferences).toHaveBeenCalledWith("u1");
  });

  it("updatePreferences delegates to service", async () => {
    svcMock.updatePreferences.mockResolvedValue({ emailMarketing: true });
    await ctrl.updatePreferences(user, { emailMarketing: true });
    expect(svcMock.updatePreferences).toHaveBeenCalledWith("u1", { emailMarketing: true });
  });
});
