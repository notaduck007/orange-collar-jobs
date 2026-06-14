export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(
      id ? `${resource} with id '${id}' not found` : `${resource} not found`,
      'NOT_FOUND',
      404,
    );
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 'CONFLICT', 409);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 422, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 'FORBIDDEN', 403);
  }
}

export class InsufficientCreditsError extends AppError {
  constructor(companyPackageId: string) {
    super(
      `Company package '${companyPackageId}' has no remaining credits`,
      'INSUFFICIENT_CREDITS',
      402,
      { companyPackageId },
    );
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, 'TOO_MANY_REQUESTS', 429);
  }
}

export class InvalidCredentialsError extends AppError {
  constructor(message = 'Email or password incorrect') {
    super(message, 'INVALID_CREDENTIALS', 401);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string) {
    super(message, 'BAD_REQUEST', 400);
  }
}
