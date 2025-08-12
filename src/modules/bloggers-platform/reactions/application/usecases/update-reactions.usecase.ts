import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ReactionsRepository } from '../../infrastructure/reactions-repository';
import { UpdateReactionDto } from '../../dto/update-reaction.dto';
import { ReactionStatusDelta } from '../../types/reaction-status-delta';
import { PostReactionDbType, ReactionStatus } from '../../types/reaction-db.type';
import { CreateReactionCommand } from './create-reaction-use.case';

export class UpdateReactionsCommand {
  constructor(public readonly dto: UpdateReactionDto) {}
}

@CommandHandler(UpdateReactionsCommand)
export class UpdateReactionUseCase implements ICommandHandler<UpdateReactionsCommand> {
  constructor(
    private readonly reactionsRepository: ReactionsRepository,
    private readonly commandBus: CommandBus,
  ) {}

  async execute({ dto }: UpdateReactionsCommand): Promise<ReactionStatusDelta> {
    const { status, userId, parentId } = dto;

    const reaction: PostReactionDbType | null = await this.reactionsRepository.getByUserIdAndPostId(
      userId,
      parentId,
    );

    if (!reaction) {
      await this.commandBus.execute(new CreateReactionCommand(dto));

      return {
        currentStatus: status,
        previousStatus: ReactionStatus.None,
      };
    }

    if (reaction.status === status) {
      return {
        currentStatus: ReactionStatus.None,
        previousStatus: ReactionStatus.None,
      };
    }

    const previousStatus: ReactionStatus = reaction.status;

    await this.reactionsRepository.updateStatusPostReaction(reaction.id, status);

    return {
      currentStatus: status,
      previousStatus,
    };
  }
}
