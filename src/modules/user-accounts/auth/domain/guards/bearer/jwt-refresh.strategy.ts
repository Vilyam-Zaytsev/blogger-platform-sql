import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { SessionContextDto } from '../dto/session-context.dto';
import { SessionsRepository } from '../../../../sessions/infrastructure/sessions.repository';
import { ICookieRequest } from '../../../../../../core/interfaces/cookie-request.interface';
import { PayloadRefreshToken } from '../../../aplication/types/payload-refresh-token.type';
import { DomainException } from '../../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../../core/exceptions/domain-exception-codes';
import { Session } from '../../../../sessions/domain/entities/session.entity';
import { Configuration } from '../../../../../../settings/configuration/configuration';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(
    private readonly config: Configuration,
    private readonly sessionsRepository: SessionsRepository,
  ) {
    const { refreshToken } = config.apiSettings.getJwtConfig();

    if (!refreshToken.secret) {
      throw new Error('REFRESH_TOKEN_SECRET is not defined in environment variables');
    }

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: ICookieRequest): string | null => req.cookies?.refreshToken ?? null,
      ]),
      ignoreExpiration: false,
      secretOrKey: refreshToken.secret,
    });
  }

  async validate(payload: PayloadRefreshToken): Promise<SessionContextDto> {
    const { userId, deviceId, iat } = payload;
    const tokenIssuedDate: Date = new Date(iat * 1000);

    const session: Session | null = await this.sessionsRepository.getByDeviceId(deviceId);

    if (!session || new Date(session.iat).getTime() !== tokenIssuedDate.getTime()) {
      throw new DomainException({
        code: DomainExceptionCode.Unauthorized,
        message: `Unauthorized`,
      });
    }

    return {
      userId,
      deviceId,
    };
  }
}
