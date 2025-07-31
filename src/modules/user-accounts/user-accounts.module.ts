import { Module } from '@nestjs/common';
import { UsersController } from './users/api/users.controller';
import { UsersRepository } from './users/infrastructure/users.repository';
import { CreateUserByAdminUseCase } from './users/application/usecases/create-user-by-admin.usecase';
import { UserValidationService } from './users/application/services/user-validation.service';
import { CryptoService } from './users/application/services/crypto.service';
import { UsersQueryRepository } from './users/infrastructure/query/users.query-repository';
import { GetUsersQueryHandler } from './users/application/queries/get-users.query-handler';
import { DeleteUserUseCase } from './users/application/usecases/delete-user.usecase';
import { AuthController } from './auth/api/auth.controller';
import { RegisterUserUseCase } from './auth/aplication/usecases/register-user.useсase';
import { ConfirmUserUseCase } from './auth/aplication/usecases/confirm-user.usecase';
import { NotificationsModule } from '../notifications/notifications.module';
import { ResendRegistrationEmailUseCase } from './auth/aplication/usecases/resend-registration-email.usecase';
import { BasicStrategy } from './auth/domain/guards/basic/basic.strategy';
import { LoginUserUseCase } from './auth/aplication/usecases/login-user.usecase';
import { AccessTokenProvider } from './auth/providers/access-token.provider';
import { RefreshTokenProvider } from './auth/providers/refresh-token.provider';
import { UserAccountsConfig } from './config/user-accounts.config';
import { JwtStrategy } from './auth/domain/guards/bearer/jwt.strategy';
import { LocalStrategy } from './auth/domain/guards/local/local.strategy';
import { CreateSessionUseCase } from './auth/aplication/usecases/sessions/create-session.usecase';
import { SessionsRepository } from './auth/infrastructure/sessions.repository';
import { JwtRefreshStrategy } from './auth/domain/guards/bearer/jwt-refresh.strategy';
import { RefreshTokenUseCase } from './auth/aplication/usecases/refreah-token.usecase';
import { LogoutUseCase } from './auth/aplication/usecases/logout.usecase';
import { GetMeQueryHandler } from './auth/aplication/queries/get-me.query-handler';
import { AuthQueryRepository } from './auth/infrastructure/query/auth.query-repository';
import { NewPasswordUseCase } from './auth/aplication/usecases/new-password.usecase';
import { PasswordRecoveryUseCase } from './auth/aplication/usecases/password-recovery.usecase';
import { SessionsController } from './sessions/api/sessions.controller';
import { GetSessionsQueryHandler } from './sessions/application/queries/get-sessions.query-handler';
import { SessionsQueryRepository } from './sessions/infrastructure/query/sessions.query-repository';

@Module({
  imports: [NotificationsModule],
  controllers: [UsersController, AuthController, SessionsController],
  providers: [
    //🔸 Auth:
    //tokens
    AccessTokenProvider,
    RefreshTokenProvider,
    // strategies
    LocalStrategy,
    JwtStrategy,
    JwtRefreshStrategy,
    BasicStrategy,
    //use-cases
    RegisterUserUseCase,
    ConfirmUserUseCase,
    ResendRegistrationEmailUseCase,
    LoginUserUseCase,
    CreateSessionUseCase,
    RefreshTokenUseCase,
    LogoutUseCase,
    PasswordRecoveryUseCase,
    NewPasswordUseCase,
    //repo
    AuthQueryRepository,
    SessionsRepository,
    SessionsQueryRepository,
    //query-handlers
    GetMeQueryHandler,
    GetSessionsQueryHandler,

    //🔸 User:
    //use-cases
    CreateUserByAdminUseCase,
    DeleteUserUseCase,
    //query-handlers
    GetUsersQueryHandler,
    //services
    CryptoService,
    UserValidationService,
    //repo
    UsersRepository,
    UsersQueryRepository,
    //config
    UserAccountsConfig,
  ],
  exports: [],
})
export class UserAccountsModule {}
