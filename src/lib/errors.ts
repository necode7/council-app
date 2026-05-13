export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class AuthError extends AppError {
  constructor(message = 'Not authenticated') {
    super(message, 'AUTH_REQUIRED', 401)
    this.name = 'AuthError'
  }
}

export class CreditError extends AppError {
  constructor(message = 'No credits remaining') {
    super(message, 'NO_CREDITS', 403)
    this.name = 'CreditError'
  }
}

export class AIError extends AppError {
  constructor(message = 'AI pipeline failed') {
    super(message, 'PIPELINE_ERROR', 500)
    this.name = 'AIError'
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed') {
    super(message, 'VALIDATION_ERROR', 400)
    this.name = 'ValidationError'
  }
}

export function errorResponse(error: unknown): Response {
  if (error instanceof AppError) {
    return Response.json(
      { error: error.message, code: error.code },
      { status: error.status },
    )
  }

  const message = error instanceof Error ? error.message : 'Internal server error'
  return Response.json(
    { error: message, code: 'INTERNAL_ERROR' },
    { status: 500 },
  )
}
