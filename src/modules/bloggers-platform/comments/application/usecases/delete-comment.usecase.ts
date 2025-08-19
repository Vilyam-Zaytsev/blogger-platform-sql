import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CommentsRepository } from '../../infrastructure/comments-repository';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';
import { CommentDb } from '../../types/comment-db.type';
import { DeleteCommentDto } from '../../dto/delete-comment.dto';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';

export class DeleteCommentCommand {
  constructor(public readonly dto: DeleteCommentDto) {}
}

@CommandHandler(DeleteCommentCommand)
export class DeleteCommentUseCase implements ICommandHandler<DeleteCommentCommand> {
  constructor(private readonly commentsRepository: CommentsRepository) {}

  async execute({ dto }: DeleteCommentCommand): Promise<void> {
    const comment: CommentDb | null = await this.commentsRepository.getById(dto.commentId);

    if (!comment) {
      throw new DomainException({
        code: DomainExceptionCode.NotFound,
        message: `The comment with ID (${dto.commentId}) does not exist`,
      });
    }

    if (comment.commentatorId !== dto.userId) {
      throw new DomainException({
        code: DomainExceptionCode.Forbidden,
        message: `The user with the ID (${dto.userId}) is not the owner of this comment`,
      });
    }

    await this.commentsRepository.softDelete(dto.commentId);
  }
}
