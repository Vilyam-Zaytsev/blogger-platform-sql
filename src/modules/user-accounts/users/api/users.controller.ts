import { Body, Controller, Post } from '@nestjs/common';
import { UserInputDto } from './input-dto/user.input-dto';

@Controller('users')
export class UsersController {
  constructor() {}

  @Post()
  async createUser(@Body() body: UserInputDto): Promise<UserViewDto> {
    const userId: string = await this.commandBus.execute(
      new CreateUserCommand(body),
    );

    return this.usersQueryRepository.getByIdOrNotFoundFail(userId);
  }
}
