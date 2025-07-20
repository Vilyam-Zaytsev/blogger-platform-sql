import { DomainException, Extension } from './domain-exceptions';
import { DomainExceptionCode } from './domain-exception-codes';

export class ValidationException extends DomainException {
  constructor(extensions: Extension[]) {
    super({
      code: DomainExceptionCode.ValidationError,
      message: 'Validation failed',
      extensions,
    });
  }
}
