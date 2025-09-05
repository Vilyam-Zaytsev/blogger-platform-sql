import { Param, ParseUUIDPipe, NotFoundException } from '@nestjs/common';

export function ValidatedSessionId(paramName = 'id'): ParameterDecorator {
  return Param(
    paramName,
    new ParseUUIDPipe({
      exceptionFactory: () => new NotFoundException('Session not found'),
    }),
  );
}
