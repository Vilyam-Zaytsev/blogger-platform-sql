import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { UserInputDto } from '../../users/api/input-dto/user.input-dto';
import { RegisterUserCommand } from '../aplication/usecases/register-user.useсase';
import { RegistrationConfirmationCodeInputDto } from './input-dto/registration-confirmation-code.input-dto';
import { ConfirmUserCommand } from '../aplication/usecases/confirm-user.usecase';
import { RegistrationEmailResandingInputDto } from './input-dto/registration-email-resending.input-dto';
import { ResendRegistrationEmailCommand } from '../aplication/usecases/resend-registration-email.usecase';

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
    return this.commandBus.execute(new RegisterUserCommand(body));
  }

  @Post('registration-confirmation')
  @HttpCode(HttpStatus.NO_CONTENT)
  async registrationConfirmation(
    @Body() body: RegistrationConfirmationCodeInputDto,
  ): Promise<void> {
    return this.commandBus.execute(new ConfirmUserCommand(body));
  }

  @Post('registration-email-resending')
  @HttpCode(HttpStatus.NO_CONTENT)
  async registrationEmailResending(
    @Body() body: RegistrationEmailResandingInputDto,
  ): Promise<void> {
    return this.commandBus.execute(new ResendRegistrationEmailCommand(body));
  }

  // @Post('login')
  // @HttpCode(HttpStatus.OK)
  // @UseGuards(LocalAuthGuard)
  // async login(
  //   @ExtractUserFromRequest() user: UserContextDto,
  //   @ExtractClientInfo() clientInfo: ClientInfoDto,
  //   @Res({ passthrough: true }) res: Response,
  // ): Promise<LoginViewDto> {
  //   const { accessToken, refreshToken }: AuthTokens =
  //     await this.commandBus.execute(new LoginUserCommand(user, clientInfo));
  //
  //   res.cookie('refreshToken', refreshToken, {
  //     httpOnly: true,
  //     secure: true,
  //     sameSite: 'strict',
  //     maxAge: 120000,
  //     path: '/',
  //   });
  //
  //   return { accessToken };
  // }
  //
  // @Post('logout')
  // @HttpCode(HttpStatus.NO_CONTENT)
  // @UseGuards(JwtRefreshAuthGuard)
  // async logout(
  //   @ExtractSessionFromRequest() session: SessionContextDto,
  // ): Promise<void> {
  //   return this.commandBus.execute(new LogoutCommand(session));
  // }
  //
  // @Post('password-recovery')
  // @HttpCode(HttpStatus.NO_CONTENT)
  // async passwordRecovery(
  //   @Body() body: PasswordRecoveryInputDto,
  // ): Promise<void> {
  //   return this.commandBus.execute(new PasswordRecoveryCommand(body));
  // }
  //
  // @Post('refresh-token')
  // @HttpCode(HttpStatus.OK)
  // @UseGuards(JwtRefreshAuthGuard)
  // async refreshToken(
  //   @ExtractSessionFromRequest() session: SessionContextDto,
  //   @Res({ passthrough: true }) res: Response,
  // ): Promise<LoginViewDto> {
  //   const { accessToken, refreshToken }: AuthTokens =
  //     await this.commandBus.execute(new RefreshTokenCommand(session));
  //
  //   res.cookie('refreshToken', refreshToken, {
  //     httpOnly: true,
  //     secure: true,
  //     sameSite: 'strict',
  //     maxAge: 120000,
  //     path: '/',
  //   });
  //
  //   return { accessToken };
  // }
  //
  // @Post('new-password')
  // @HttpCode(HttpStatus.NO_CONTENT)
  // async newPassword(@Body() body: NewPasswordInputDto): Promise<void> {
  //   return this.commandBus.execute(new NewPasswordCommand(body));
  // }
  //
  // @Get('me')
  // @UseGuards(JwtAuthGuard)
  // async me(@ExtractUserFromRequest() user: UserContextDto): Promise<MeViewDto> {
  //   return this.queryBus.execute(new GetMeQuery(user.id));
  // }
}
