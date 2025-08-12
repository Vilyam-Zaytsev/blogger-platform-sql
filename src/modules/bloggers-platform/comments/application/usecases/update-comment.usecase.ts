import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UpdateCommentDto } from '../../dto/update-comment.dto';
import { CommentsRepository } from '../../infrastructure/comments-repository';
import { CommentDbType } from '../../types/comment-db.type';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';

export class UpdateCommentCommand {
  constructor(public readonly dto: UpdateCommentDto) {}
}

@CommandHandler(UpdateCommentCommand)
export class UpdateCommentUseCase implements ICommandHandler<UpdateCommentCommand> {
  constructor(private readonly commentsRepository: CommentsRepository) {}

  async execute({ dto }: UpdateCommentCommand): Promise<void> {
    const comment: CommentDbType = await this.commentsRepository.getByIdOrNotFoundFail(
      dto.commentId,
    );

    if (comment.commentatorId !== dto.userId) {
      throw new DomainException({
        code: DomainExceptionCode.Forbidden,
        message: `The user with the ID (${dto.userId}) is not the owner of this comment`,
      });
    }

    return await this.commentsRepository.updateContent({
      commentId: dto.commentId,
      content: dto.content,
    });
  }
}
