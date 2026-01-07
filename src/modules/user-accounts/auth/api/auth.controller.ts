import { Body, Controller, Get, HttpCode, HttpStatus, Post, Res, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { UserInputDto } from '../../users/api/input-dto/user.input-dto';
import { RegisterUserCommand } from '../aplication/usecases/register-user.useсase';
import { RegistrationConfirmationCodeInputDto } from './input-dto/registration-confirmation-code.input-dto';
import { ConfirmEmailCommand } from '../aplication/usecases/confirm-email-use.case';
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
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { LoginInputDto } from './input-dto/login.input-dto';
import { Configuration } from '../../../../settings/configuration/configuration';
import { ConfigService } from '@nestjs/config';
import { ApiSettings } from '../../../../settings/configuration/api-settings';

@ApiTags('Authentication')
@UseGuards(ThrottlerGuard)
@Controller('auth')
export class AuthController {
  constructor(
    private readonly configService: ConfigService<Configuration, true>,
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post('registration')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Регистрация нового пользователя',
    description: `
Создаёт новый аккаунт пользователя.

**ВАЖНО**: После успешной регистрации на email будет отправлена ссылка подтверждения.
Пользователь НЕ может войти, пока не подтвердит email.

**Rate limit:** 5 запросов за 10 секунд на один email
    `,
  })
  @ApiBody({
    type: UserInputDto,
    examples: {
      example1: {
        summary: 'Пример регистрации',
        value: {
          login: 'user',
          email: 'user@example.com',
          password: 'MySecurePassword123',
        },
      },
    },
  })
  @ApiResponse({
    status: 204,
    description:
      'Входные данные принимаются. Письмо с кодом подтверждения будет отправлено на переданный адрес электронной почты',
  })
  @ApiResponse({
    status: 400,
    description: 'Ошибка валидации (invalid email, weak password, etc)',
    example: {
      errorsMessages: [
        {
          message: 'string',
          field: 'string',
        },
      ],
    },
  })
  @ApiResponse({
    status: 429,
    description:
      'Превышен лимит запросов (rate limited). Более 5 попыток с одного IP-адреса за 10 секунд',
  })
  async registration(@Body() body: UserInputDto): Promise<void> {
    await this.commandBus.execute(new RegisterUserCommand(body));
  }

  @Post('registration-confirmation')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Подтверждение email адреса',
    description: `
Подтверждает email пользователя по коду из письма.

После подтверждения пользователь сможет входить в систему.

**Код действует:** 1 час с момента регистрации
**Формат кода:** UUID (отправлен на email)
    `,
  })
  @ApiBody({
    type: RegistrationConfirmationCodeInputDto,
    examples: {
      example1: {
        summary: 'Пример подтверждения',
        value: {
          code: '550e8400-e29b-41d4-a716-446655440000',
        },
      },
    },
  })
  @ApiResponse({
    status: 204,
    description: 'Электронная почта была подтверждена. Аккаунт был активирован',
  })
  @ApiResponse({
    status: 400,
    description: 'Если код подтверждения неверен, просрочен или уже применён',
    example: {
      errorsMessages: [
        {
          message: 'string',
          field: 'string',
        },
      ],
    },
  })
  @ApiResponse({
    status: 429,
    description:
      'Превышен лимит запросов (rate limited). Более 5 попыток с одного IP-адреса за 10 секунд',
  })
  async registrationConfirmation(
    @Body() body: RegistrationConfirmationCodeInputDto,
  ): Promise<void> {
    await this.commandBus.execute(new ConfirmEmailCommand(body));
  }

  @Post('registration-email-resending')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Переотправка письма подтверждения email',
    description: `
Генерирует и отправляет новое письмо подтверждения.

Используется, если:
- Пользователь не получил исходное письмо
- Код истек (> 1 часа)
- Письмо попало в спам

**Rate limit:** 5 попыток за 10 секунд
    `,
  })
  @ApiBody({
    type: RegistrationEmailResandingInputDto,
  })
  @ApiResponse({
    status: 204,
    description:
      'Входные данные принимаются. Письмо с кодом подтверждения будет отправлено на адрес переданной электронной почты. Код подтверждения должен быть внутри ссылки как параметр запроса',
    example:
      'https://some-front.com/confirm-registration?code=550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 400,
    description: 'Если inputModel имеет неправильные значения',
  })
  @ApiResponse({
    status: 429,
    description: 'Превышен лимит переотправок',
  })
  async registrationEmailResending(
    @Body() body: RegistrationEmailResandingInputDto,
  ): Promise<void> {
    await this.commandBus.execute(new ResendRegistrationEmailCommand(body));
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(LocalAuthGuard)
  @ApiOperation({ summary: 'Попытка входа пользователя в систему' })
  @ApiBody({
    type: LoginInputDto,
    schema: {
      example: {
        loginOrEmail: 'user@example.com',
        password: 'MySecurePassword123',
      },
    },
  })
  @ApiResponse({
    status: 200,
    description:
      'Успешный вход. Access Token возвращается в теле, Refresh Token устанавливается в httpOnly cookie.',
    content: {
      'application/json': {
        example: {
          accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
      },
    },
    headers: {
      'Set-Cookie': {
        schema: {
          type: 'string',
          example:
            'refreshToken=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...; Path=/; HttpOnly; Secure; SameSite=Strict',
        },
        description: 'JWT Refresh Token записывается в защищенную httpOnly cookie',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Неверный логин или пароль' })
  @ApiResponse({ status: 429, description: 'Слишком много попыток входа' })
  async login(
    @ExtractUserFromRequest() user: UserContextDto,
    @ExtractClientInfo() clientInfo: ClientInfoDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginViewDto> {
    const { accessToken, refreshToken }: AuthTokens = await this.commandBus.execute(
      new LoginUserCommand(user, clientInfo),
    );

    res.cookie(
      'refreshToken',
      refreshToken,
      this.configService.get<ApiSettings>('apiSettings').getCookieOptions(),
    );

    return { accessToken };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtRefreshAuthGuard)
  async logout(
    @ExtractSessionFromRequest() session: SessionContextDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.commandBus.execute(new LogoutCommand(session));

    const { httpOnly, secure, sameSite, path } = this.configService
      .get<ApiSettings>('apiSettings')
      .getCookieOptions();

    res.clearCookie('refreshToken', {
      httpOnly,
      secure,
      sameSite,
      path,
    });
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

    res.cookie(
      'refreshToken',
      refreshToken,
      this.configService.get<ApiSettings>('apiSettings').getCookieOptions(),
    );

    return { accessToken };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@ExtractUserFromRequest() user: UserContextDto): Promise<MeViewDto> {
    return this.queryBus.execute(new GetMeQuery(user.id));
  }
}
