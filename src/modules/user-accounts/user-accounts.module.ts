import { Module } from '@nestjs/common';
import { UsersController } from './users/api/users.controller';
import { UsersRepository } from './users/infrastructure/users.repository';
import { CreateUserByAdminUseCase } from './users/application/usecases/create-user-by-admin.usecase';
import { UserValidationService } from './users/application/services/user-validation.service';
import { CryptoService } from './users/application/services/crypto.service';
import { UsersQueryRepository } from './users/infrastructure/query/users.query-repository';
import { GetUsersQueryHandler } from './users/application/queries/get-users.query-handler';

@Module({
  imports: [],
  controllers: [UsersController],
  providers: [
    //🔸 User:
    //use-cases
    CreateUserByAdminUseCase,
    //query-handlers
    GetUsersQueryHandler,
    //services
    CryptoService,
    UserValidationService,
    //repo
    UsersRepository,
    UsersQueryRepository,
  ],
  exports: [],
})
export class UserAccountsModule {}
