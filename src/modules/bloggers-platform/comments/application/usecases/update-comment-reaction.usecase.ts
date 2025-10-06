import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UpdatePostReactionCommand } from '../../../reactions/application/usecases/update-post-reaction.usecase';
import { CommentsRepository } from '../../infrastructure/comments-repository';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';
import { ReactionUpdateDto } from '../../../reactions/dto/reaction.create-dto';
import { Comment } from '../../domain/entities/comment.entity';
import { Reaction } from '../../../reactions/domain/entities/reaction.entity';
import { ReactionsRepository } from '../../../reactions/infrastructure/reactions.repository';

export class UpdateCommentReactionCommand {
  constructor(public readonly dto: ReactionUpdateDto) {}
}

@CommandHandler(UpdateCommentReactionCommand)
export class UpdateCommentReactionUseCase implements ICommandHandler<UpdateCommentReactionCommand> {
  constructor(
    private readonly commentsRepository: CommentsRepository,
    private readonly reactionsRepository: ReactionsRepository,
  ) {}

  async execute({ dto }: UpdatePostReactionCommand): Promise<void> {
    const comment: Comment | null = await this.commentsRepository.getById(dto.parentId);

    if (!comment) {
      throw new DomainException({
        code: DomainExceptionCode.NotFound,
        message: `The comment with ID (${dto.parentId}) does not exist`,
      });
    }

    const reaction: Reaction | null = await this.reactionsRepository.getByUserIdAndCommentId(
      dto.userId,
      dto.parentId,
    );

    if (!reaction) {
      const reaction: Reaction = Reaction.createForComment(dto);
      await this.reactionsRepository.save(reaction);

      return;
    }

    reaction.updateStatus(dto.status);
    await this.reactionsRepository.save(reaction);
  }
}
