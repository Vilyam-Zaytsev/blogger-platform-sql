import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CreateUserDto } from '../../dto/create-user.dto';
import { UserValidationService } from '../services/user-validation.service';
import { UsersRepository } from '../../infrastructure/users.repository';
import { User } from '../../domain/entities/user.entity';
import { UsersFactory } from '../factories/users.factory';

export class CreateUserCommand {
  constructor(public readonly dto: CreateUserDto) {}
}

@CommandHandler(CreateUserCommand)
export class CreateUserByAdminUseCase implements ICommandHandler<CreateUserCommand> {
  constructor(
    private readonly userValidation: UserValidationService,
    private readonly usersRepository: UsersRepository,
    private readonly userFactory: UsersFactory,
  ) {}

  async execute({ dto }: CreateUserCommand): Promise<number> {
    await this.userValidation.validateUniqueUser(dto.login, dto.email);

    const user: User = await this.userFactory.create(dto);

    user.confirmEmail();
    return await this.usersRepository.save(user);
  }
}
