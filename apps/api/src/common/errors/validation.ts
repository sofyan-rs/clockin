import { ValidationPipe, type ValidationError } from '@nestjs/common';

import { AppError } from './app-error';

interface FieldError {
  field: string;
  messages: string[];
}

function flatten(errors: ValidationError[], parent = ''): FieldError[] {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const own = error.constraints ? [{ field, messages: Object.values(error.constraints) }] : [];
    return [...own, ...flatten(error.children ?? [], field)];
  });
}

/** ARCHITECTURE §4.2 global validation; failures become VALIDATION_FAILED with per-field messages. */
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) => new AppError('VALIDATION_FAILED', { errors: flatten(errors) }),
  });
}
