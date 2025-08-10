import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { BasicStrategy } from './basic.strategy';
import { DomainException } from '../../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../../core/exceptions/domain-exception-codes';
import { parseAdminBasicAuth } from '../../../../../../core/utils/admin-credentials.parser';
import { IS_PUBLIC_KEY } from '../../../../decorators/public.decorator';

@Injectable()
export class BasicAuthGuard implements CanActivate {
  constructor(
    private readonly strategy: BasicStrategy,
    private reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic: boolean = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const authHeader: string | undefined = request.headers.authorization;

    let username: string;
    let password: string;

    try {
      [username, password] = parseAdminBasicAuth(authHeader);

      this.strategy.validate(username, password);

      return true;
    } catch (error) {
      throw new DomainException({
        code: DomainExceptionCode.Unauthorized,
        message: 'unauthorised',
      });
    }
  }
}
