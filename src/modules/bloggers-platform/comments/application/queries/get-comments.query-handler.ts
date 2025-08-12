import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PaginatedViewDto } from '../../../../../core/dto/paginated.view-dto';
import { CommentViewDto } from '../../api/view-dto/comment-view.dto';
import { CommentsQueryRepository } from '../../infrastructure/query/comments.query-repository';
import { PostsRepository } from '../../../posts/infrastructure/posts.repository';
import { CommentsQueryDto } from '../../dto/comments-query.dto';

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
    await this.postsRepository.getByIdOrNotFoundFail(dto.postId);

    return this.commentsQueryRepository.getAll(dto);
  }
}
