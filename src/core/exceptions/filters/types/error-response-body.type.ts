import { DomainExceptionCode } from '../../domain-exception-codes';
import { Extension } from '../../domain-exceptions';

export type ErrorResponseBody = {
  timestamp: string;
  path: string | null;
  method: string | null;
  message: string;
  extensions: Extension[];
  code: DomainExceptionCode;
};
