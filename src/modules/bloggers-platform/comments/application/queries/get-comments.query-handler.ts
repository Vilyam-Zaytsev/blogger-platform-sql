import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PaginatedViewDto } from '../../../../../core/dto/paginated.view-dto';
import { CommentViewDto } from '../../api/view-dto/comment-view.dto';
import { CommentsQueryRepository } from '../../infrastructure/query/comments.query-repository';
import { PostsRepository } from '../../../posts/infrastructure/posts.repository';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';
import { Post } from '../../../posts/domain/entities/post.entity';
import { GetCommentsQueryParams } from '../../api/input-dto/get-comments-query-params.input-dto';
import { UserContextDto } from '../../../../user-accounts/auth/domain/guards/dto/user-context.dto';

export class GetCommentsQuery {
  constructor(
    public readonly query: GetCommentsQueryParams,
    public readonly postId: number,
    public readonly user: UserContextDto | null,
  ) {}
}

@QueryHandler(GetCommentsQuery)
export class GetCommentsQueryHandler
  implements IQueryHandler<GetCommentsQuery, PaginatedViewDto<CommentViewDto>>
{
  constructor(
    private readonly commentsQueryRepository: CommentsQueryRepository,
    private readonly postsRepository: PostsRepository,
  ) {}

  async execute({
    query,
    postId,
    user,
  }: GetCommentsQuery): Promise<PaginatedViewDto<CommentViewDto>> {
    const post: Post | null = await this.postsRepository.getById(postId);

    if (!post) {
      throw new DomainException({
        code: DomainExceptionCode.NotFound,
        message: `The post with ID (${postId}) does not exist`,
      });
    }

    return this.commentsQueryRepository.getAll(query, postId, user);
  }
}
