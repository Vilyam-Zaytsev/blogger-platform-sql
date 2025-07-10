import { Body, Controller, Post } from '@nestjs/common';
import { UserInputDto } from './input-dto/user.input-dto';
import { UserViewDto } from './view-dto/user.view-dto';
import { CommandBus } from '@nestjs/cqrs';
import { CreateUserCommand } from '../application/usecases/create-user-by-admin.usecase';
import { UsersRepository } from '../infrastructure/users.repository';
import { UsersQueryRepository } from '../infrastructure/query/users.query-repository';

@Controller('users')
export class UsersController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly usersRepository: UsersRepository,
    private readonly usersQueryRepository: UsersQueryRepository,
  ) {}

  @Post()
  async createUser(@Body() body: UserInputDto): Promise<UserViewDto> {
    const userId: number = await this.commandBus.execute(
      new CreateUserCommand(body),
    );

    return this.usersQueryRepository.getByIdOrNotFoundFail(userId);
  }
}
