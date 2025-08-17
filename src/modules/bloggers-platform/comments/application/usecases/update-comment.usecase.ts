import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UpdateCommentDto } from '../../dto/update-comment.dto';
import { CommentsRepository } from '../../infrastructure/comments-repository';
import { CommentDb } from '../../types/comment-db.type';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';

export class UpdateCommentCommand {
  constructor(public readonly dto: UpdateCommentDto) {}
}

@CommandHandler(UpdateCommentCommand)
export class UpdateCommentUseCase implements ICommandHandler<UpdateCommentCommand> {
  constructor(private readonly commentsRepository: CommentsRepository) {}

  async execute({ dto }: UpdateCommentCommand): Promise<void> {
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

    await this.commentsRepository.update({
      commentId: dto.commentId,
      content: dto.content,
    });
  }
}
