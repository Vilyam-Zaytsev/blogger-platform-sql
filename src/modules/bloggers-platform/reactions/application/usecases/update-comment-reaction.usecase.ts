import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UpdatePostReactionCommand } from './update-post-reaction.usecase';
import { CommentsRepository } from '../../../comments/infrastructure/comments-repository';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';
import { ReactionUpdateDto } from '../../dto/reaction.create-dto';
import { Comment } from '../../../comments/domain/entities/comment.entity';
import { Reaction } from '../../domain/entities/reaction.entity';
import { ReactionsRepository } from '../../infrastructure/reactions.repository';

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
