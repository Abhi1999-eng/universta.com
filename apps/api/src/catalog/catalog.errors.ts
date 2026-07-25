import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

export function catalogConflict(
  code: string,
  message: string,
  details: unknown = null,
): ConflictException {
  return new ConflictException({ code, message, details });
}

export function catalogNotFound(
  code: string,
  message: string,
): NotFoundException {
  return new NotFoundException({ code, message, details: null });
}

export function catalogBadRequest(
  code: string,
  message: string,
  details: unknown = null,
): BadRequestException {
  return new BadRequestException({ code, message, details });
}

export function catalogNotReady(
  code: string,
  message: string,
  details: unknown,
): UnprocessableEntityException {
  return new UnprocessableEntityException({ code, message, details });
}
