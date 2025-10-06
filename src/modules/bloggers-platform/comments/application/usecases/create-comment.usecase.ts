import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PostsRepository } from '../../../posts/infrastructure/posts.repository';
import { CommentsRepository } from '../../infrastructure/comments-repository';
import { CommentCreateDto } from '../dto/comment.create-dto';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';
import { Post } from '../../../posts/domain/entities/post.entity';
import { Comment } from '../../domain/entities/comment.entity';

export class CreateCommentCommand {
  constructor(public readonly dto: CommentCreateDto) {}
}

@CommandHandler(CreateCommentCommand)
export class CreateCommentUseCase implements ICommandHandler<CreateCommentCommand> {
  constructor(
    private readonly postsRepository: PostsRepository,
    private readonly commentsRepository: CommentsRepository,
  ) {}

  async execute({ dto }: CreateCommentCommand): Promise<number> {
    const post: Post | null = await this.postsRepository.getById(dto.postId);

    if (!post) {
      throw new DomainException({
        code: DomainExceptionCode.NotFound,
        message: `The post with ID (${dto.postId}) does not exist`,
      });
    }

    const comment: Comment = Comment.create(dto);
    return await this.commentsRepository.save(comment);
  }
}
