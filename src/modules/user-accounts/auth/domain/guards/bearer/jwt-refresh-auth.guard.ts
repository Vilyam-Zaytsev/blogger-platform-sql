import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SessionContextDto } from '../dto/session-context.dto';
import { DomainException } from '../../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../../core/exceptions/domain-exception-codes';

@Injectable()
export class JwtRefreshAuthGuard extends AuthGuard('jwt-refresh') {
  handleRequest<TSession = SessionContextDto>(
    err: any,
    session: any,
  ): TSession {
    if (err || !session) {
      throw new DomainException({
        code: DomainExceptionCode.Unauthorized,
        message: 'Unauthorized',
      });
    }

    return session as TSession;
  }
}
