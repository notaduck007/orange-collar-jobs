import type { ConfigService } from "@nestjs/config";

const verificationsCreate = jest.fn();
const verificationChecksCreate = jest.fn();
const messagesCreate = jest.fn();
const lookupFetch = jest.fn();

const mockClient = {
  verify: {
    v2: {
      services: jest.fn().mockReturnValue({
        verifications: { create: verificationsCreate },
        verificationChecks: { create: verificationChecksCreate },
      }),
    },
  },
  messages: { create: messagesCreate },
  lookups: {
    v2: {
      phoneNumbers: jest.fn().mockReturnValue({ fetch: lookupFetch }),
    },
  },
};

const twilioFactory = jest.fn().mockReturnValue(mockClient);
jest.mock("twilio", () => twilioFactory);

import { SmsService } from "@core/sms/sms.service";

type EnvValues = Record<string, string | undefined>;

function makeConfig(values: EnvValues): ConfigService {
  return { get: jest.fn((key: string) => values[key]) } as unknown as ConfigService;
}

const configuredEnv: EnvValues = {
  TWILIO_ACCOUNT_SID: "AC_test",
  TWILIO_AUTH_TOKEN: "token_test",
  TWILIO_FROM_NUMBER: "+15550000000",
  TWILIO_VERIFY_SERVICE_SID: "VA_test",
};

describe("SmsService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    twilioFactory.mockReturnValue(mockClient);
  });

  describe("when Twilio is not configured", () => {
    const svc = new SmsService(makeConfig({}));

    it("does not construct a Twilio client", () => {
      expect(twilioFactory).not.toHaveBeenCalled();
    });

    it("sendVerificationCode is a no-op", async () => {
      await expect(svc.sendVerificationCode("+1555")).resolves.toBeUndefined();
      expect(verificationsCreate).not.toHaveBeenCalled();
    });

    it("checkVerificationCode returns false", async () => {
      await expect(svc.checkVerificationCode("+1555", "123")).resolves.toBe(false);
    });

    it("isValidMobileNumber is permissive (returns true)", async () => {
      await expect(svc.isValidMobileNumber("+1555")).resolves.toBe(true);
    });

    it("notification senders are no-ops", async () => {
      await svc.sendApplicationUpdate("+1", "Picker", "hired");
      await svc.sendNewApplicantAlert("+1", "Picker", "Jane");
      await svc.sendJobAlert("+1", "Picker", "Dallas", "https://x");
      expect(messagesCreate).not.toHaveBeenCalled();
    });
  });

  describe("when Twilio is configured", () => {
    let svc: SmsService;

    beforeEach(() => {
      svc = new SmsService(makeConfig(configuredEnv));
    });

    it("constructs a Twilio client with the credentials", () => {
      expect(twilioFactory).toHaveBeenCalledWith("AC_test", "token_test");
    });

    it("sendVerificationCode dispatches via Verify", async () => {
      verificationsCreate.mockResolvedValue({});
      await svc.sendVerificationCode("+15551234567", "sms");
      expect(mockClient.verify.v2.services).toHaveBeenCalledWith("VA_test");
      expect(verificationsCreate).toHaveBeenCalledWith({ to: "+15551234567", channel: "sms" });
    });

    it("checkVerificationCode returns true when approved", async () => {
      verificationChecksCreate.mockResolvedValue({ status: "approved" });
      await expect(svc.checkVerificationCode("+15551234567", "000000")).resolves.toBe(true);
    });

    it("checkVerificationCode returns false when not approved", async () => {
      verificationChecksCreate.mockResolvedValue({ status: "pending" });
      await expect(svc.checkVerificationCode("+15551234567", "000000")).resolves.toBe(false);
    });

    it("isValidMobileNumber returns true for mobile line types", async () => {
      lookupFetch.mockResolvedValue({ lineTypeIntelligence: { type: "mobile" } });
      await expect(svc.isValidMobileNumber("+15551234567")).resolves.toBe(true);
    });

    it("isValidMobileNumber returns false for landline line types", async () => {
      lookupFetch.mockResolvedValue({ lineTypeIntelligence: { type: "landline" } });
      await expect(svc.isValidMobileNumber("+15551234567")).resolves.toBe(false);
    });

    it("isValidMobileNumber returns false when lookup throws", async () => {
      lookupFetch.mockRejectedValue(new Error("invalid number"));
      await expect(svc.isValidMobileNumber("bad")).resolves.toBe(false);
    });

    it("sendApplicationUpdate sends an SMS", async () => {
      messagesCreate.mockResolvedValue({});
      await svc.sendApplicationUpdate("+15551234567", "Forklift Operator", "shortlisted");
      expect(messagesCreate).toHaveBeenCalledWith(
        expect.objectContaining({ to: "+15551234567", from: "+15550000000" }),
      );
    });

    it("sendNewApplicantAlert sends an SMS", async () => {
      messagesCreate.mockResolvedValue({});
      await svc.sendNewApplicantAlert("+15551234567", "Forklift Operator", "Jane Doe");
      expect(messagesCreate).toHaveBeenCalled();
    });

    it("sendJobAlert sends an SMS with an unsubscribe note", async () => {
      messagesCreate.mockResolvedValue({});
      await svc.sendJobAlert("+15551234567", "Picker", "Dallas", "https://wj.com/a");
      const body = (messagesCreate.mock.calls[0][0] as { body: string }).body;
      expect(body).toContain("STOP");
    });
  });

  describe("when credentials exist but Verify SID / from-number are missing", () => {
    let svc: SmsService;

    beforeEach(() => {
      svc = new SmsService(
        makeConfig({ TWILIO_ACCOUNT_SID: "AC_test", TWILIO_AUTH_TOKEN: "token_test" }),
      );
    });

    it("sendVerificationCode is a no-op without a Verify SID", async () => {
      await expect(svc.sendVerificationCode("+15551234567")).resolves.toBeUndefined();
      expect(verificationsCreate).not.toHaveBeenCalled();
    });

    it("checkVerificationCode returns false without a Verify SID", async () => {
      await expect(svc.checkVerificationCode("+15551234567", "000000")).resolves.toBe(false);
    });

    it("notification senders are no-ops without a from-number", async () => {
      await svc.sendApplicationUpdate("+1", "Picker", "hired");
      await svc.sendNewApplicantAlert("+1", "Picker", "Jane");
      await svc.sendJobAlert("+1", "Picker", "Dallas", "https://x");
      expect(messagesCreate).not.toHaveBeenCalled();
    });
  });
});
