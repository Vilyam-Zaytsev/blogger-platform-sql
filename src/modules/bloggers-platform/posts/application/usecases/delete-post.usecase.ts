import { PostsRepository } from '../../infrastructure/posts.repository';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';

export class DeletePostCommand {
  constructor(public readonly id: number) {}
}

@CommandHandler(DeletePostCommand)
export class DeletePostUseCase implements ICommandHandler<DeletePostCommand> {
  constructor(private readonly postsRepository: PostsRepository) {}

  async execute({ id }: DeletePostCommand) {
    const result = await this.postsRepository.softDelete(id);

    if (!result) {
      throw new DomainException({
        code: DomainExceptionCode.NotFound,
        message: `The user with ID (${id}) does not exist`,
      });
    }
  }
}
