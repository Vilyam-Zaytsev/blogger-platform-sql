import { Body, Controller, Get, HttpCode, HttpStatus, Post, Res, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { UserInputDto } from '../../users/api/input-dto/user.input-dto';
import { RegisterUserCommand } from '../aplication/usecases/register-user.useсase';
import { RegistrationConfirmationCodeInputDto } from './input-dto/registration-confirmation-code.input-dto';
import { ConfirmUserCommand } from '../aplication/usecases/confirm-user.usecase';
import { RegistrationEmailResandingInputDto } from './input-dto/registration-email-resending.input-dto';
import { ResendRegistrationEmailCommand } from '../aplication/usecases/resend-registration-email.usecase';
import { LocalAuthGuard } from '../domain/guards/local/local-auth.guard';
import { ExtractClientInfo } from '../../../../core/decorators/request/extract-client-info.decorator';
import { ClientInfoDto } from '../../../../core/dto/client-info.dto';
import { UserContextDto } from '../domain/guards/dto/user-context.dto';
import { ExtractUserFromRequest } from '../domain/guards/decorators/extract-user-from-request.decorator';
import { LoginViewDto } from './view-dto/login.view-dto';
import { AuthTokens } from '../domain/types/auth-tokens.type';
import { LoginUserCommand } from '../aplication/usecases/login-user.usecase';
import { Response } from 'express';
import { JwtRefreshAuthGuard } from '../domain/guards/bearer/jwt-refresh-auth.guard';
import { SessionContextDto } from '../domain/guards/dto/session-context.dto';
import { ExtractSessionFromRequest } from '../domain/guards/decorators/extract-session-from-request.decorator';
import { LogoutCommand } from '../aplication/usecases/logout.usecase';
import { PasswordRecoveryInputDto } from './input-dto/password-recovery.input-dto';
import { PasswordRecoveryCommand } from '../aplication/usecases/password-recovery.usecase';
import { RefreshTokenCommand } from '../aplication/usecases/refreah-token.usecase';
import { NewPasswordInputDto } from './input-dto/new-password-input.dto';
import { NewPasswordCommand } from '../aplication/usecases/new-password.usecase';
import { JwtAuthGuard } from '../domain/guards/bearer/jwt-auth.guard';
import { MeViewDto } from '../../users/api/view-dto/user.view-dto';
import { GetMeQuery } from '../aplication/queries/get-me.query-handler';

@UseGuards(ThrottlerGuard)
@Controller('auth')
export class AuthController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post('registration')
  @HttpCode(HttpStatus.NO_CONTENT)
  async registration(@Body() body: UserInputDto): Promise<void> {
    await this.commandBus.execute(new RegisterUserCommand(body));
  }

  @Post('registration-confirmation')
  @HttpCode(HttpStatus.NO_CONTENT)
  async registrationConfirmation(
    @Body() body: RegistrationConfirmationCodeInputDto,
  ): Promise<void> {
    await this.commandBus.execute(new ConfirmUserCommand(body));
  }

  @Post('registration-email-resending')
  @HttpCode(HttpStatus.NO_CONTENT)
  async registrationEmailResending(
    @Body() body: RegistrationEmailResandingInputDto,
  ): Promise<void> {
    await this.commandBus.execute(new ResendRegistrationEmailCommand(body));
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(LocalAuthGuard)
  async login(
    @ExtractUserFromRequest() user: UserContextDto,
    @ExtractClientInfo() clientInfo: ClientInfoDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginViewDto> {
    const { accessToken, refreshToken }: AuthTokens = await this.commandBus.execute(
      new LoginUserCommand(user, clientInfo),
    );

    //TODO: вынести в config!
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 120000,
      path: '/',
    });

    return { accessToken };
  }

  //TODO: реализовать скедулер для удаления завершенных сессий.
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtRefreshAuthGuard)
  async logout(@ExtractSessionFromRequest() session: SessionContextDto): Promise<void> {
    await this.commandBus.execute(new LogoutCommand(session));
  }

  @Post('password-recovery')
  @HttpCode(HttpStatus.NO_CONTENT)
  async passwordRecovery(@Body() body: PasswordRecoveryInputDto): Promise<void> {
    await this.commandBus.execute(new PasswordRecoveryCommand(body));
  }

  @Post('new-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async newPassword(@Body() body: NewPasswordInputDto): Promise<void> {
    await this.commandBus.execute(new NewPasswordCommand(body));
  }

  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtRefreshAuthGuard)
  async refreshToken(
    @ExtractSessionFromRequest() session: SessionContextDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginViewDto> {
    const { accessToken, refreshToken }: AuthTokens = await this.commandBus.execute(
      new RefreshTokenCommand(session),
    );

    //TODO: вынести в config!
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 120000,
      path: '/',
    });

    return { accessToken };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@ExtractUserFromRequest() user: UserContextDto): Promise<MeViewDto> {
    return this.queryBus.execute(new GetMeQuery(user.id));
  }
}
