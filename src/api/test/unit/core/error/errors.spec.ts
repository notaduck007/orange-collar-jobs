import {
  AppError,
  NotFoundError,
  ConflictError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  InsufficientCreditsError,
  TooManyRequestsError,
} from "@core/error/errors";

describe("AppError hierarchy", () => {
  describe("AppError", () => {
    it("sets message, code, statusCode, and name", () => {
      const err = new AppError("test message", "TEST_CODE", 400);
      expect(err.message).toBe("test message");
      expect(err.code).toBe("TEST_CODE");
      expect(err.statusCode).toBe(400);
      expect(err.name).toBe("AppError");
      expect(err instanceof Error).toBe(true);
    });

    it("optionally sets details", () => {
      const details = { field: "email" };
      const err = new AppError("msg", "CODE", 400, details);
      expect(err.details).toEqual(details);
    });
  });

  describe("NotFoundError", () => {
    it("uses NOT_FOUND code and 404 status", () => {
      const err = new NotFoundError("Job", "abc-123");
      expect(err.code).toBe("NOT_FOUND");
      expect(err.statusCode).toBe(404);
      expect(err.message).toContain("abc-123");
    });

    it("works without an id", () => {
      const err = new NotFoundError("Job");
      expect(err.message).toBe("Job not found");
    });
  });

  describe("ConflictError", () => {
    it("uses CONFLICT code and 409 status", () => {
      const err = new ConflictError("email already exists");
      expect(err.code).toBe("CONFLICT");
      expect(err.statusCode).toBe(409);
    });
  });

  describe("ValidationError", () => {
    it("uses VALIDATION_ERROR code and 422 status", () => {
      const err = new ValidationError("invalid input");
      expect(err.code).toBe("VALIDATION_ERROR");
      expect(err.statusCode).toBe(422);
    });

    it("carries optional details", () => {
      const err = new ValidationError("invalid input", { field: "email" });
      expect(err.details).toEqual({ field: "email" });
    });
  });

  describe("UnauthorizedError", () => {
    it('defaults to "Unauthorized"', () => {
      const err = new UnauthorizedError();
      expect(err.statusCode).toBe(401);
      expect(err.message).toBe("Unauthorized");
    });

    it("accepts a custom message", () => {
      expect(new UnauthorizedError("token expired").message).toBe("token expired");
    });
  });

  describe("ForbiddenError", () => {
    it('defaults to "Forbidden"', () => {
      const err = new ForbiddenError();
      expect(err.statusCode).toBe(403);
    });

    it("accepts a custom message", () => {
      expect(new ForbiddenError("role not allowed").message).toBe("role not allowed");
    });
  });

  describe("TooManyRequestsError", () => {
    it("uses TOO_MANY_REQUESTS code and 429 status", () => {
      const err = new TooManyRequestsError();
      expect(err.code).toBe("TOO_MANY_REQUESTS");
      expect(err.statusCode).toBe(429);
    });
  });

  describe("InsufficientCreditsError", () => {
    it("includes packageId in message and details", () => {
      const err = new InsufficientCreditsError("pkg-xyz");
      expect(err.statusCode).toBe(402);
      expect(err.message).toContain("pkg-xyz");
      expect(err.details).toEqual({ companyPackageId: "pkg-xyz" });
    });
  });
});
