import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { AppError } from "./errors.js";

interface ErrorBody {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let body: ErrorBody;

    if (exception instanceof AppError) {
      status = exception.statusCode;
      body = { code: exception.code, message: exception.message };
      if (exception.details) body.details = exception.details;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === "string") {
        body = { code: "HTTP_ERROR", message: res };
      } else {
        const r = res as Record<string, unknown>;
        body = {
          code: (r["error"] as string | undefined) ?? "HTTP_ERROR",
          message: Array.isArray(r["message"])
            ? (r["message"] as string[]).join("; ")
            : ((r["message"] as string | undefined) ?? "An error occurred"),
        };
      }
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      body = { code: "INTERNAL_SERVER_ERROR", message: "An unexpected error occurred" };
      this.logger.error(
        { err: exception, path: request.url, method: request.method },
        "Unhandled exception",
      );
    }

    response.status(status).json(body);
  }
}
