import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CommentsRepository } from '../../infrastructure/comments-repository';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';
import { CommentDbType } from '../../types/comment-db.type';
import { DeleteCommentDto } from '../../dto/delete-comment.dto';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';

export class DeleteCommentCommand {
  constructor(public readonly dto: DeleteCommentDto) {}
}

@CommandHandler(DeleteCommentCommand)
export class DeleteCommentUseCase
  implements ICommandHandler<DeleteCommentCommand>
{
  constructor(private readonly commentsRepository: CommentsRepository) {}

  async execute({ dto }: DeleteCommentCommand): Promise<void> {
    const comment: CommentDbType =
      await this.commentsRepository.getByIdOrNotFoundFail(dto.commentId);

    if (comment.commentatorId !== dto.userId) {
      throw new DomainException({
        code: DomainExceptionCode.Forbidden,
        message: `The user with the ID (${dto.userId}) is not the owner of this comment`,
      });
    }

    await this.commentsRepository.softDelete(dto.commentId);
  }
}
