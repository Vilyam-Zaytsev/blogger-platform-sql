import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UpdateReactionsCommand } from '../../../reactions/application/usecases/update-reactions.usecase';
import { UpdatePostReactionCommand } from '../../../posts/application/usecases/update-post-reaction.usecase';
import { CommentsRepository } from '../../infrastructure/comments-repository';
import { UpdateReactionDto } from '../../../reactions/dto/update-reaction.dto';

export class UpdateCommentReactionCommand {
  constructor(public readonly dto: UpdateReactionDto) {}
}

@CommandHandler(UpdateCommentReactionCommand)
export class UpdateCommentReactionUseCase implements ICommandHandler<UpdateCommentReactionCommand> {
  constructor(
    private readonly commentsRepository: CommentsRepository,
    private readonly commandBus: CommandBus,
  ) {}

  async execute({ dto }: UpdatePostReactionCommand): Promise<void> {
    await this.commentsRepository.getById(dto.parentId);

    await this.commandBus.execute(new UpdateReactionsCommand(dto));
  }
}
