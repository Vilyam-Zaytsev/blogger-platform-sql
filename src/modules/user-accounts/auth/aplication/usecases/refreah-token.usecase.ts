import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';
import { SessionContextDto } from '../../domain/guards/dto/session-context.dto';
import {
  ACCESS_TOKEN_STRATEGY_INJECT_TOKEN,
  REFRESH_TOKEN_STRATEGY_INJECT_TOKEN,
} from '../../constants/auth-tokens.inject-constants';
import { SessionsRepository } from '../../infrastructure/sessions.repository';
import { AuthTokens } from '../../domain/types/auth-tokens.type';
import { PayloadRefreshToken } from '../types/payload-refresh-token.type';
import { SessionDbType } from '../../types/session-db.type';
import { UpdateSessionTimestamps } from '../types/update-session-timestamps.type';
import { Session } from '../../domain/entities/session.entity';

export class RefreshTokenCommand {
  constructor(public readonly dto: SessionContextDto) {}
}

@CommandHandler(RefreshTokenCommand)
export class RefreshTokenUseCase implements ICommandHandler<RefreshTokenCommand> {
  constructor(
    @Inject(ACCESS_TOKEN_STRATEGY_INJECT_TOKEN)
    private readonly accessTokenContext: JwtService,

    @Inject(REFRESH_TOKEN_STRATEGY_INJECT_TOKEN)
    private readonly refreshTokenContext: JwtService,

    private readonly sessionsRepository: SessionsRepository,
  ) {}

  async execute({ dto }: RefreshTokenCommand): Promise<AuthTokens> {
    const [accessToken, refreshToken] = await Promise.all([
      this.accessTokenContext.sign({ id: dto.userId }),
      this.refreshTokenContext.sign({
        userId: dto.userId,
        deviceId: dto.deviceId,
      }),
    ]);

    const { iat, exp }: PayloadRefreshToken =
      this.refreshTokenContext.decode<PayloadRefreshToken>(refreshToken);

    const session: Session | null = await this.sessionsRepository.getByDeviceId(dto.deviceId);

    if (!session) {
      throw new DomainException({
        code: DomainExceptionCode.Unauthorized,
        message: `Unauthorized`,
      });
    }

    const updateTimestampsDto: UpdateSessionTimestamps = {
      sessionId: session.id,
      iat: new Date(iat * 1000),
      exp: new Date(exp * 1000),
    };

    await this.sessionsRepository.updateTimestamps(updateTimestampsDto);

    return {
      accessToken,
      refreshToken,
    };
  }
}
