import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UpdatePostReactionCommand } from '../../../reactions/application/usecases/update-post-reaction.usecase';
import { CommentsRepository } from '../../infrastructure/comments-repository';
import { CommentDb } from '../../types/comment-db.type';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';
import { ReactionDb } from '../../../reactions/types/reaction-db.type';
import { ReactionUpdateDto } from '../../../reactions/dto/reaction.create-dto';

export class UpdateCommentReactionCommand {
  constructor(public readonly dto: ReactionUpdateDto) {}
}

@CommandHandler(UpdateCommentReactionCommand)
export class UpdateCommentReactionUseCase implements ICommandHandler<UpdateCommentReactionCommand> {
  constructor(private readonly commentsRepository: CommentsRepository) {}

  async execute({ dto }: UpdatePostReactionCommand): Promise<void> {
    const comment: CommentDb | null = await this.commentsRepository.getById(dto.parentId);

    if (!comment) {
      throw new DomainException({
        code: DomainExceptionCode.NotFound,
        message: `The comment with ID (${dto.parentId}) does not exist`,
      });
    }

    const reaction: ReactionDb | null =
      await this.commentsRepository.getReactionByUserIdAndCommentId(dto.userId, dto.parentId);

    if (!reaction) {
      return await this.commentsRepository.createReaction(dto);
    }

    await this.commentsRepository.updateStatusPostReaction(reaction.id, dto.status);
  }
}
