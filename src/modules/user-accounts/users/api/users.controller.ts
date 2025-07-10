import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { UserInputDto } from './input-dto/user.input-dto';
import { UserViewDto } from './view-dto/user.view-dto';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { CreateUserCommand } from '../application/usecases/create-user-by-admin.usecase';
import { UsersRepository } from '../infrastructure/users.repository';
import { UsersQueryRepository } from '../infrastructure/query/users.query-repository';
import { GetUsersQueryParams } from './input-dto/get-users-query-params.input-dto';
import { PaginatedViewDto } from '../../../../core/dto/paginated.view-dto';
import { GetUsersQuery } from '../application/queries/get-users.query-handler';

@Controller('users')
export class UsersController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
    private readonly usersRepository: UsersRepository,
    private readonly usersQueryRepository: UsersQueryRepository,
  ) {}

  @Get()
  async getAll(
    @Query() query: GetUsersQueryParams,
  ): Promise<PaginatedViewDto<UserViewDto>> {
    return this.queryBus.execute(new GetUsersQuery(query));
  }

  @Post()
  async createUser(@Body() body: UserInputDto): Promise<UserViewDto> {
    const userId: number = await this.commandBus.execute(
      new CreateUserCommand(body),
    );

    return this.usersQueryRepository.getByIdOrNotFoundFail(userId);
  }
}
