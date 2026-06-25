import { ForbiddenError } from "@core/error/errors";
import { InboundMessageHandler } from "@domains/notifications/inbound-message.handler";

jest.mock("twilio", () => ({
  __esModule: true,
  default: { validateRequest: jest.fn() },
}));

import Twilio from "twilio";

const notificationsMock = {
  recordSmsOptOut: jest.fn(),
  findUserByPhone: jest.fn(),
  createInboundNotification: jest.fn(),
  findUserByEmail: jest.fn(),
};

const configMock = { get: jest.fn(() => undefined) };

let handler: InboundMessageHandler;

beforeEach(() => {
  jest.clearAllMocks();
  handler = new InboundMessageHandler(notificationsMock as never, configMock as never);
});

describe("InboundMessageHandler", () => {
  it("records STOP opt-out", async () => {
    const twiml = await handler.handleTwilioSms({ From: "+15551112222", Body: "STOP" }, "valid");
    expect(notificationsMock.recordSmsOptOut).toHaveBeenCalledWith("+15551112222");
    expect(twiml).toContain("unsubscribed");
  });

  it("rejects invalid signature in test mode", async () => {
    await expect(
      handler.handleTwilioSms({ From: "+1", Body: "Hi" }, "invalid"),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("creates inbox notification for conversational SMS", async () => {
    notificationsMock.findUserByPhone.mockResolvedValue({ id: "u1" });
    await handler.handleTwilioSms({ From: "+15551112222", Body: "Hello" }, "valid");
    expect(notificationsMock.createInboundNotification).toHaveBeenCalled();
  });

  it("accepts resend inbound in test mode", async () => {
    notificationsMock.findUserByEmail.mockResolvedValue({ id: "u1" });
    await handler.handleResendInbound(
      { from: "a@test.com", subject: "Re:", text: "Thanks" },
      { "x-resend-signature": "ok" },
    );
    expect(notificationsMock.createInboundNotification).toHaveBeenCalled();
  });

  it("returns HELP twiml", async () => {
    const twiml = await handler.handleTwilioSms({ From: "+1", Body: "HELP" }, "valid");
    expect(twiml).toContain("WarehouseJobs");
  });

  it("returns INFO twiml for help keyword variant", async () => {
    const twiml = await handler.handleTwilioSms({ From: "+1", Body: "INFO" }, "valid");
    expect(twiml).toContain("WarehouseJobs");
  });

  it("records CANCEL keyword opt-out", async () => {
    await handler.handleTwilioSms({ From: "+1", Body: "CANCEL" }, "valid");
    expect(notificationsMock.recordSmsOptOut).toHaveBeenCalledWith("+1");
  });

  it("handles payload with lowercase from only", async () => {
    notificationsMock.findUserByPhone.mockResolvedValue({ id: "u1" });
    await handler.handleTwilioSms({ from: "+15551112222", body: "ping" }, "valid");
    expect(notificationsMock.createInboundNotification).toHaveBeenCalledWith(
      "u1",
      "New SMS reply",
      "ping",
    );
  });

  it("rejects resend webhook with invalid signature in test mode", async () => {
    await expect(
      handler.handleResendInbound({}, { "x-resend-signature": "invalid" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("handles lowercase from/body payload fields", async () => {
    notificationsMock.findUserByPhone.mockResolvedValue({ id: "u1" });
    await handler.handleTwilioSms({ from: "+15551112222", body: "Hello" }, "valid");
    expect(notificationsMock.createInboundNotification).toHaveBeenCalledWith(
      "u1",
      "New SMS reply",
      "Hello",
    );
  });

  it("records UNSUBSCRIBE keyword opt-out", async () => {
    const twiml = await handler.handleTwilioSms({ From: "+1", Body: "UNSUBSCRIBE" }, "valid");
    expect(notificationsMock.recordSmsOptOut).toHaveBeenCalledWith("+1");
    expect(twiml).toContain("unsubscribed");
  });

  it("does not create inbox notification when sender unknown", async () => {
    notificationsMock.findUserByPhone.mockResolvedValue(null);
    const twiml = await handler.handleTwilioSms({ From: "+1999", Body: "Hello" }, "valid");
    expect(twiml).toBe("");
    expect(notificationsMock.createInboundNotification).not.toHaveBeenCalled();
  });

  it("resend inbound uses sender and html fallbacks", async () => {
    notificationsMock.findUserByEmail.mockResolvedValue({ id: "u1" });
    await handler.handleResendInbound(
      { sender: "sender@test.com", html: "<p>Hi</p>" },
      { "x-resend-signature": "ok" },
    );
    expect(notificationsMock.createInboundNotification).toHaveBeenCalledWith(
      "u1",
      "Inbound email",
      "<p>Hi</p>",
    );
  });

  it("resend inbound skips notification when sender not registered", async () => {
    notificationsMock.findUserByEmail.mockResolvedValue(null);
    await handler.handleResendInbound(
      { from: "unknown@test.com", text: "Hello" },
      { "x-resend-signature": "ok" },
    );
    expect(notificationsMock.createInboundNotification).not.toHaveBeenCalled();
  });
});

describe("InboundMessageHandler production", () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it("rejects twilio webhook when validation not configured", async () => {
    process.env.NODE_ENV = "production";
    const prodHandler = new InboundMessageHandler(notificationsMock as never, configMock as never);
    await expect(
      prodHandler.handleTwilioSms({ From: "+1", Body: "Hi" }, "sig"),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("rejects resend webhook without signature in production", async () => {
    process.env.NODE_ENV = "production";
    const prodHandler = new InboundMessageHandler(notificationsMock as never, configMock as never);
    await expect(prodHandler.handleResendInbound({}, {})).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("validates twilio signature when production config present", async () => {
    process.env.NODE_ENV = "production";
    const prodConfig = {
      get: jest.fn((key: string) => {
        if (key === "TWILIO_AUTH_TOKEN") return "auth-token";
        if (key === "WEBHOOK_BASE_URL") return "https://api.example.com";
        return undefined;
      }),
    };
    (Twilio.validateRequest as jest.Mock).mockReturnValue(true);
    const prodHandler = new InboundMessageHandler(notificationsMock as never, prodConfig as never);
    await prodHandler.handleTwilioSms({ From: "+1", Body: "Hi" }, "valid-sig");
    expect(Twilio.validateRequest).toHaveBeenCalled();
  });

  it("rejects invalid twilio signature in production", async () => {
    process.env.NODE_ENV = "production";
    const prodConfig = {
      get: jest.fn((key: string) => {
        if (key === "TWILIO_AUTH_TOKEN") return "auth-token";
        if (key === "WEBHOOK_BASE_URL") return "https://api.example.com";
        return undefined;
      }),
    };
    (Twilio.validateRequest as jest.Mock).mockReturnValue(false);
    const prodHandler = new InboundMessageHandler(notificationsMock as never, prodConfig as never);
    await expect(
      prodHandler.handleTwilioSms({ From: "+1", Body: "Hi" }, "bad-sig"),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("accepts resend inbound with svix-signature in production", async () => {
    process.env.NODE_ENV = "production";
    const prodHandler = new InboundMessageHandler(notificationsMock as never, configMock as never);
    notificationsMock.findUserByEmail.mockResolvedValue(null);
    await prodHandler.handleResendInbound({ from: "a@test.com" }, { "svix-signature": "present" });
  });
});
