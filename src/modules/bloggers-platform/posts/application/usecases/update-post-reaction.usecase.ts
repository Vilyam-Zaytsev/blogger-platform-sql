import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UpdateReactionDto } from '../../../reactions/dto/update-reaction.dto';
import { PostsRepository } from '../../infrastructure/posts.repository';
import { UpdateReactionsCommand } from '../../../reactions/application/usecases/update-reactions.usecase';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';
import { PostDb } from '../../types/post-db.type';

export class UpdatePostReactionCommand {
  constructor(public readonly dto: UpdateReactionDto) {}
}

@CommandHandler(UpdatePostReactionCommand)
export class UpdatePostReactionUseCase implements ICommandHandler<UpdatePostReactionCommand> {
  constructor(
    private readonly postsRepository: PostsRepository,
    private readonly commandBus: CommandBus,
  ) {}

  async execute({ dto }: UpdatePostReactionCommand): Promise<void> {
    const post: PostDb | null = await this.postsRepository.getById(dto.parentId);

    if (!post) {
      throw new DomainException({
        code: DomainExceptionCode.NotFound,
        message: `The post with ID (${dto.parentId}) does not exist`,
      });
    }

    await this.commandBus.execute(new UpdateReactionsCommand(dto));
  }
}
