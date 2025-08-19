import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ClientInfoDto } from '../../../../../core/dto/client-info.dto';
import { UserContextDto } from '../../domain/guards/dto/user-context.dto';
import {
  ACCESS_TOKEN_STRATEGY_INJECT_TOKEN,
  REFRESH_TOKEN_STRATEGY_INJECT_TOKEN,
} from '../../constants/auth-tokens.inject-constants';
import { CryptoService } from '../../../users/application/services/crypto.service';
import { AuthTokens } from '../../domain/types/auth-tokens.type';
import { PayloadRefreshToken } from '../types/payload-refresh-token.type';
import { CreateSessionDto } from '../../dto/create-session.dto';
import { CreateSessionCommand } from './sessions/create-session.usecase';

export class LoginUserCommand {
  constructor(
    public readonly user: UserContextDto,
    public readonly clientInfo: ClientInfoDto,
  ) {}
}

@CommandHandler(LoginUserCommand)
export class LoginUserUseCase implements ICommandHandler<LoginUserCommand> {
  constructor(
    @Inject(ACCESS_TOKEN_STRATEGY_INJECT_TOKEN)
    private readonly accessTokenContext: JwtService,

    @Inject(REFRESH_TOKEN_STRATEGY_INJECT_TOKEN)
    private readonly refreshTokenContext: JwtService,

    private readonly cryptoService: CryptoService,
    private readonly commandBus: CommandBus,
  ) {}

  async execute({ user, clientInfo }: LoginUserCommand): Promise<AuthTokens> {
    const accessToken: string = this.accessTokenContext.sign({
      id: user.id,
    });

    const deviceId: string = this.cryptoService.generateUUID();
    const refreshToken: string = this.refreshTokenContext.sign({
      userId: user.id,
      deviceId,
    });

    const { iat, exp }: PayloadRefreshToken =
      this.refreshTokenContext.decode<PayloadRefreshToken>(refreshToken);

    const createSessionDto: CreateSessionDto = {
      userId: user.id,
      deviceId,
      userAgent: clientInfo.userAgent,
      ip: clientInfo.ip,
      iat,
      exp,
    };

    await this.commandBus.execute(new CreateSessionCommand(createSessionDto));

    return {
      accessToken,
      refreshToken,
    };
  }
}
