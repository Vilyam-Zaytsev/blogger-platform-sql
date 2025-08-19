import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PaginatedViewDto } from '../../../../../core/dto/paginated.view-dto';
import { CommentViewDto } from '../../api/view-dto/comment-view.dto';
import { CommentsQueryRepository } from '../../infrastructure/query/comments.query-repository';
import { PostsRepository } from '../../../posts/infrastructure/posts.repository';
import { CommentsQueryDto } from '../../dto/comments-query.dto';
import { PostDb } from '../../../posts/types/post-db.type';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';

export class GetCommentsQuery {
  constructor(public readonly dto: CommentsQueryDto) {}
}

@QueryHandler(GetCommentsQuery)
export class GetCommentsQueryHandler
  implements IQueryHandler<GetCommentsQuery, PaginatedViewDto<CommentViewDto>>
{
  constructor(
    private readonly commentsQueryRepository: CommentsQueryRepository,
    private readonly postsRepository: PostsRepository,
  ) {}

  async execute({ dto }: GetCommentsQuery): Promise<PaginatedViewDto<CommentViewDto>> {
    const post: PostDb | null = await this.postsRepository.getById(dto.postId);

    if (!post) {
      throw new DomainException({
        code: DomainExceptionCode.NotFound,
        message: `The post with ID (${dto.postId}) does not exist`,
      });
    }

    return this.commentsQueryRepository.getAll(dto);
  }
}
