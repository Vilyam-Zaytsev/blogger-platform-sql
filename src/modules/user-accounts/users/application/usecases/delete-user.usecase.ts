import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UsersRepository } from '../../infrastructure/users.repository';

export class DeleteUserCommand {
  constructor(public readonly id: number) {}
}

@CommandHandler(DeleteUserCommand)
export class DeleteUserUseCase implements ICommandHandler<DeleteUserCommand> {
  constructor(private readonly usersRepository: UsersRepository) {}

  async execute({ id }: DeleteUserCommand): Promise<void> {
    await this.usersRepository.getByIdOrNotFoundFail(id);
    await this.usersRepository.softDelete(id);
  }
}
