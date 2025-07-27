import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IdInputDto } from '../../../../../core/dto/id.input-dto';
import { UsersRepository } from '../../infrastructure/users.repository';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';

export class DeleteUserCommand {
  constructor(public readonly dto: IdInputDto) {}
}

@CommandHandler(DeleteUserCommand)
export class DeleteUserUseCase implements ICommandHandler<DeleteUserCommand> {
  constructor(private readonly usersRepository: UsersRepository) {}

  async execute({ dto }: DeleteUserCommand): Promise<void> {
    const result: boolean = await this.usersRepository.softDelete(dto.id);

    if (!result) {
      throw new DomainException({
        code: DomainExceptionCode.NotFound,
        message: `The user with ID (${dto.id}) does not exist`,
      });
    }
  }
}
