import { GlobalExceptionFilter } from "@core/error/global-exception.filter";
import { HttpException, HttpStatus } from "@nestjs/common";
import { AppError, NotFoundError, ForbiddenError } from "@core/error/errors";
import type { ArgumentsHost } from "@nestjs/common";

function buildMockHost(method = "GET", url = "/test"): ArgumentsHost {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const getResponse = jest.fn().mockReturnValue({ status });
  const getRequest = jest.fn().mockReturnValue({ method, url });
  const switchToHttp = jest.fn().mockReturnValue({ getResponse, getRequest });
  return { switchToHttp } as unknown as ArgumentsHost;
}

describe("GlobalExceptionFilter", () => {
  const filter = new GlobalExceptionFilter();

  it("maps AppError to its statusCode", () => {
    const host = buildMockHost();
    const err = new NotFoundError("Job", "123");
    filter.catch(err, host);

    const statusMock = (host.switchToHttp().getResponse() as { status: jest.Mock }).status;
    expect(statusMock).toHaveBeenCalledWith(404);
  });

  it("maps HttpException to its status", () => {
    const host = buildMockHost();
    const err = new HttpException("Not allowed", HttpStatus.METHOD_NOT_ALLOWED);
    filter.catch(err, host);

    const statusMock = (host.switchToHttp().getResponse() as { status: jest.Mock }).status;
    expect(statusMock).toHaveBeenCalledWith(405);
  });

  it("maps ForbiddenError to 403", () => {
    const host = buildMockHost();
    filter.catch(new ForbiddenError(), host);

    const statusMock = (host.switchToHttp().getResponse() as { status: jest.Mock }).status;
    expect(statusMock).toHaveBeenCalledWith(403);
  });

  it("maps unknown errors to 500", () => {
    const host = buildMockHost();
    filter.catch(new Error("unhandled"), host);

    const statusMock = (host.switchToHttp().getResponse() as { status: jest.Mock }).status;
    expect(statusMock).toHaveBeenCalledWith(500);
  });

  it("includes code and message in the JSON body", () => {
    const host = buildMockHost();
    const err = new AppError("Something failed", "CUSTOM_CODE", 418);
    filter.catch(err, host);

    const jsonMock = (host.switchToHttp().getResponse() as { status: jest.Mock }).status.mock
      .results[0].value as { json: jest.Mock };
    expect(jsonMock.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "CUSTOM_CODE", message: "Something failed" }),
    );
  });

  it("includes AppError details in the body when present", () => {
    const host = buildMockHost();
    filter.catch(new AppError("bad", "X", 400, { field: "a" }), host);
    const jsonMock = (host.switchToHttp().getResponse() as { status: jest.Mock }).status.mock
      .results[0].value as { json: jest.Mock };
    expect(jsonMock.json).toHaveBeenCalledWith(
      expect.objectContaining({ details: { field: "a" } }),
    );
  });

  it("joins array messages from a ValidationPipe HttpException", () => {
    const host = buildMockHost();
    const err = new HttpException(
      { error: "Bad Request", message: ["email must be an email", "name should not be empty"] },
      HttpStatus.BAD_REQUEST,
    );
    filter.catch(err, host);
    const jsonMock = (host.switchToHttp().getResponse() as { status: jest.Mock }).status.mock
      .results[0].value as { json: jest.Mock };
    expect(jsonMock.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "Bad Request",
        message: "email must be an email; name should not be empty",
      }),
    );
  });

  it("handles a string HttpException response", () => {
    const host = buildMockHost();
    filter.catch(new HttpException("plain text error", HttpStatus.BAD_REQUEST), host);
    const jsonMock = (host.switchToHttp().getResponse() as { status: jest.Mock }).status.mock
      .results[0].value as { json: jest.Mock };
    expect(jsonMock.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "HTTP_ERROR", message: "plain text error" }),
    );
  });

  it("falls back to defaults for an object response missing error/message keys", () => {
    const host = buildMockHost();
    filter.catch(new HttpException({}, HttpStatus.BAD_REQUEST), host);
    const jsonMock = (host.switchToHttp().getResponse() as { status: jest.Mock }).status.mock
      .results[0].value as { json: jest.Mock };
    expect(jsonMock.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "HTTP_ERROR", message: "An error occurred" }),
    );
  });

  it("handles an object response with a single string message", () => {
    const host = buildMockHost();
    filter.catch(new HttpException({ message: "single message" }, HttpStatus.BAD_REQUEST), host);
    const jsonMock = (host.switchToHttp().getResponse() as { status: jest.Mock }).status.mock
      .results[0].value as { json: jest.Mock };
    expect(jsonMock.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "single message" }),
    );
  });
});
