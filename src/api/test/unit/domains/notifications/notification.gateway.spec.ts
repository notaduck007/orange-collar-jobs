import { NotificationGateway } from "@domains/notifications/notification.gateway";

describe("NotificationGateway", () => {
  it("emits to subscribed listeners", () => {
    const gw = new NotificationGateway();
    const payloads: unknown[] = [];
    const unsub = gw.subscribe("u1", (p) => payloads.push(p));
    const notification = {
      id: "n1",
      userId: "u1",
      title: "T",
      body: "B",
      link: null,
      type: "system" as const,
      senderId: null,
      read: false,
      readAt: null,
      createdAt: new Date(),
    };
    gw.emitNotificationCreated("u1", notification);
    unsub();
    expect(payloads).toHaveLength(1);
  });

  it("does not emit to other user rooms", () => {
    const gw = new NotificationGateway();
    const payloads: unknown[] = [];
    gw.subscribe("u2", (p) => payloads.push(p));
    gw.emitNotificationCreated("u1", {
      id: "n1",
      userId: "u1",
      title: "T",
      body: "B",
      link: null,
      type: "system",
      senderId: null,
      read: false,
      readAt: null,
      createdAt: new Date(),
    });
    expect(payloads).toHaveLength(0);
  });
});
