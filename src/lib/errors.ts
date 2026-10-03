export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (
    let depth = 0;
    typeof current === 'object' && current !== null && depth < 5;
    depth += 1
  ) {
    if ('code' in current && (current as { code?: unknown }).code === '23505') {
      return true;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}
