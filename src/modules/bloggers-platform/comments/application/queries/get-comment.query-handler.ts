import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { CommentViewDto } from '../../api/view-dto/comment-view.dto';
import { CommentQueryDto } from '../../dto/comment-query.dto';
import { CommentsQueryRepository } from '../../infrastructure/query/comments.query-repository';

export class GetCommentQuery {
  constructor(public readonly dto: CommentQueryDto) {}
}

@QueryHandler(GetCommentQuery)
export class GetCommentQueryHandler implements IQueryHandler<GetCommentQuery, CommentViewDto> {
  constructor(private readonly commentQueryRepository: CommentsQueryRepository) {}

  async execute({ dto }: GetCommentQuery): Promise<CommentViewDto> {
    return this.commentQueryRepository.getByIdOrNotFoundFail(dto.commentId, dto.userId);
  }
}
