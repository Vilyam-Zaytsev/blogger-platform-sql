import { ValidationError } from '@nestjs/common';
import { Extension } from '../damain-exceptions';

export const errorFormatter = (errors: ValidationError[]): Extension[] => {
  const errorsForResponse: Extension[] = [];
  const stack: ValidationError[] = [...errors];

  while (stack.length > 0) {
    const error: ValidationError = stack.pop()!;
    if (error.constraints) {
      for (const message of Object.values(error.constraints)) {
        errorsForResponse.push({
          field: error.property,
          message: message ? `${message}; Received value: ${error.value}` : '',
        });
      }
    } else if (error.children && error.children.length > 0) {
      stack.push(...error.children);
    }
  }

  return errorsForResponse;
};
