import { WebhooksController } from "@domains/notifications/webhooks.controller";

const inboundMock = {
  handleTwilioSms: jest.fn(),
  handleResendInbound: jest.fn(),
};

let ctrl: WebhooksController;

beforeEach(() => {
  jest.clearAllMocks();
  ctrl = new WebhooksController(inboundMock as never);
});

describe("WebhooksController", () => {
  it("twilioSms returns TwiML when handler provides response", async () => {
    inboundMock.handleTwilioSms.mockResolvedValue("<Response></Response>");
    const res = { type: jest.fn().mockReturnThis(), send: jest.fn(), status: jest.fn().mockReturnThis() };
    await ctrl.twilioSms({ body: { From: "+1", Body: "STOP" } } as never, "sig", res as never);
    expect(res.type).toHaveBeenCalledWith("text/xml");
    expect(res.send).toHaveBeenCalled();
  });

  it("twilioSms returns empty 200 when no TwiML", async () => {
    inboundMock.handleTwilioSms.mockResolvedValue("");
    const res = { type: jest.fn().mockReturnThis(), send: jest.fn(), status: jest.fn().mockReturnThis() };
    await ctrl.twilioSms({ body: {} } as never, "sig", res as never);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("resendInbound delegates to handler", async () => {
    await ctrl.resendInbound({ from: "a@test.com" }, { "x-resend-signature": "ok" });
    expect(inboundMock.handleResendInbound).toHaveBeenCalledWith(
      { from: "a@test.com" },
      { "x-resend-signature": "ok" },
    );
  });

  it("twilioSms handles undefined body and signature", async () => {
    inboundMock.handleTwilioSms.mockResolvedValue("");
    const res = { type: jest.fn().mockReturnThis(), send: jest.fn(), status: jest.fn().mockReturnThis() };
    await ctrl.twilioSms({} as never, undefined as never, res as never);
    expect(inboundMock.handleTwilioSms).toHaveBeenCalledWith({}, "");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalled();
  });

  it("twilioSms sends TwiML xml when handler returns content", async () => {
    inboundMock.handleTwilioSms.mockResolvedValue("<Response><Message>OK</Message></Response>");
    const res = { type: jest.fn().mockReturnThis(), send: jest.fn(), status: jest.fn().mockReturnThis() };
    await ctrl.twilioSms({ body: { From: "+1", Body: "HELP" } } as never, "sig", res as never);
    expect(res.type).toHaveBeenCalledWith("text/xml");
    expect(res.send).toHaveBeenCalledWith("<Response><Message>OK</Message></Response>");
    expect(res.status).not.toHaveBeenCalled();
  });
});
