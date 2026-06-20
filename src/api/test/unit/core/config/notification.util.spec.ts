import type { ConfigService } from "@nestjs/config";
import { shouldSendExternalEmail, isTwilioConfigured } from "@core/config/notification.util";
import type { Env } from "@core/config/env.schema";

function mockConfig(values: Partial<Env>): ConfigService<Env> {
  return {
    get: (key: keyof Env) => values[key],
  } as ConfigService<Env>;
}

describe("notification.util", () => {
  it("shouldSendExternalEmail is false in test", () => {
    expect(
      shouldSendExternalEmail(
        mockConfig({ NODE_ENV: "test", EMAIL_API_KEY: "re_live_actual_key_abcdefghijklmnopqrst" }),
      ),
    ).toBe(false);
  });

  it("shouldSendExternalEmail is true in production", () => {
    expect(
      shouldSendExternalEmail(mockConfig({ NODE_ENV: "production", EMAIL_API_KEY: "re_x" })),
    ).toBe(true);
  });

  it("shouldSendExternalEmail detects real Resend key in development", () => {
    expect(
      shouldSendExternalEmail(
        mockConfig({
          NODE_ENV: "development",
          EMAIL_API_KEY: "re_live_actual_key_abcdefghijklmnopqrst",
        }),
      ),
    ).toBe(true);
  });

  it("shouldSendExternalEmail skips placeholder keys in development", () => {
    expect(
      shouldSendExternalEmail(
        mockConfig({
          NODE_ENV: "development",
          EMAIL_API_KEY: "re_xxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        }),
      ),
    ).toBe(false);
  });

  it("isTwilioConfigured requires AC sid and auth token", () => {
    expect(
      isTwilioConfigured(
        mockConfig({ TWILIO_ACCOUNT_SID: "ACabc123", TWILIO_AUTH_TOKEN: "secret_token" }),
      ),
    ).toBe(true);
    expect(isTwilioConfigured(mockConfig({ TWILIO_ACCOUNT_SID: "ACabc123" }))).toBe(false);
  });
});
