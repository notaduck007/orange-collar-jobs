import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { BatchAuthGuard } from "@domains/batch/batch-auth.guard";
import { TEST_API_KEY, TEST_API_KEY_HASH } from "../../../helpers/batch.fixtures";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const prismaMock = {
  apiKey: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
};

const configMock = {
  get: jest.fn(),
};

function makeContext(headers: Record<string, string | undefined>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers }),
    }),
    getClass: () => ({}),
    getHandler: () => ({}),
  } as unknown as ExecutionContext;
}

// ── Guard under test ──────────────────────────────────────────────────────────

let guard: BatchAuthGuard;

beforeEach(() => {
  jest.clearAllMocks();
  guard = new BatchAuthGuard(prismaMock as never, configMock as never);
  // Suppress superclass AuthGuard JWT call side-effects in unit tests
  jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(guard)) as never, "canActivate")
    .mockResolvedValue(true as never);
});

// ── API key path ──────────────────────────────────────────────────────────────

describe("BatchAuthGuard — X-Api-Key header", () => {
  it("passes and sets req.apiKeyAuth when DB record matches", async () => {
    const dbRecord = { id: "key-1", expiresAt: null, companyId: "co-1" };
    prismaMock.apiKey.findUnique.mockResolvedValueOnce(dbRecord);
    prismaMock.apiKey.update.mockResolvedValue({});

    const req: Record<string, unknown> = { headers: { "x-api-key": TEST_API_KEY } };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(req.apiKeyAuth).toEqual({ apiKeyId: "key-1", companyId: "co-1" });
    expect(prismaMock.apiKey.findUnique).toHaveBeenCalledWith({
      where: { keyHash: TEST_API_KEY_HASH },
    });
  });

  it("passes via env-var fallback when no DB record", async () => {
    prismaMock.apiKey.findUnique.mockResolvedValueOnce(null);
    configMock.get.mockReturnValue(TEST_API_KEY_HASH);

    const req: Record<string, unknown> = { headers: { "x-api-key": TEST_API_KEY } };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(req.apiKeyAuth).toEqual({ apiKeyId: null, companyId: null });
  });

  it("passes when expiresAt is in the future", async () => {
    const dbRecord = {
      id: "key-future",
      expiresAt: new Date(Date.now() + 86_400_000), // tomorrow
      companyId: "co-future",
    };
    prismaMock.apiKey.findUnique.mockResolvedValueOnce(dbRecord);
    prismaMock.apiKey.update.mockResolvedValue({});

    const req: Record<string, unknown> = { headers: { "x-api-key": TEST_API_KEY } };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(req.apiKeyAuth).toMatchObject({ apiKeyId: "key-future", companyId: "co-future" });
  });

  it("rejects expired API key", async () => {
    prismaMock.apiKey.findUnique.mockResolvedValueOnce({
      id: "key-expired",
      expiresAt: new Date("2000-01-01"),
      companyId: null,
    });
    configMock.get.mockReturnValue("not-matching-hash");

    const ctx = makeContext({ "x-api-key": TEST_API_KEY });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("sets companyId null when api key record has no company association", async () => {
    const dbRecord = { id: "key-no-co", expiresAt: null, companyId: null };
    prismaMock.apiKey.findUnique.mockResolvedValueOnce(dbRecord);
    prismaMock.apiKey.update.mockResolvedValue({});

    const req: Record<string, unknown> = { headers: { "x-api-key": TEST_API_KEY } };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;

    await guard.canActivate(ctx);
    expect(req.apiKeyAuth).toEqual({ apiKeyId: "key-no-co", companyId: null });
  });

  it("rejects invalid API key (no DB record, no env match)", async () => {
    prismaMock.apiKey.findUnique.mockResolvedValueOnce(null);
    configMock.get.mockReturnValue("wrong-hash");

    const ctx = makeContext({ "x-api-key": "bad-key" });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

// ── JWT fallback ──────────────────────────────────────────────────────────────

describe("BatchAuthGuard — JWT Bearer fallback", () => {
  it("delegates to parent AuthGuard when no X-Api-Key header", async () => {
    const ctx = makeContext({ authorization: "Bearer some.jwt.token" });
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true); // mocked parent returns true
    expect(prismaMock.apiKey.findUnique).not.toHaveBeenCalled();
  });
});
