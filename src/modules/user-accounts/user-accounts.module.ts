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

@Module({
  imports: [NotificationsModule],
  controllers: [UsersController, AuthController],
  providers: [
    //🔸 Auth:
    //tokens
    AccessTokenProvider,
    RefreshTokenProvider,
    // strategies
    BasicStrategy,
    //use-cases
    RegisterUserUseCase,
    ConfirmUserUseCase,
    ResendRegistrationEmailUseCase,
    LoginUserUseCase,

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
