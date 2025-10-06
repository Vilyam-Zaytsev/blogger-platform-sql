import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CommentUpdateDto } from '../dto/comment.update-dto';
import { CommentsRepository } from '../../infrastructure/comments-repository';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';
import { Comment } from '../../domain/entities/comment.entity';

export class UpdateCommentCommand {
  constructor(public readonly dto: CommentUpdateDto) {}
}

@CommandHandler(UpdateCommentCommand)
export class UpdateCommentUseCase implements ICommandHandler<UpdateCommentCommand> {
  constructor(private readonly commentsRepository: CommentsRepository) {}

  async execute({ dto }: UpdateCommentCommand): Promise<void> {
    const comment: Comment | null = await this.commentsRepository.getById(dto.commentId);

    if (!comment) {
      throw new DomainException({
        code: DomainExceptionCode.NotFound,
        message: `The comment with ID (${dto.commentId}) does not exist`,
      });
    }

    if (comment.userId !== dto.userId) {
      throw new DomainException({
        code: DomainExceptionCode.Forbidden,
        message: `The user with the ID (${dto.userId}) is not the owner of this comment`,
      });
    }

    comment.updateContent(dto.content);
    await this.commentsRepository.save(comment);
  }
}
