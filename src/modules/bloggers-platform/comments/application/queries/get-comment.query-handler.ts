import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { CommentViewDto } from '../../api/view-dto/comment-view.dto';
import { CommentsQueryRepository } from '../../infrastructure/query/comments.query-repository';
import { UserContextDto } from '../../../../user-accounts/auth/domain/guards/dto/user-context.dto';

export class GetCommentQuery {
  constructor(
    public readonly commentId: number,
    public readonly user: UserContextDto | null,
  ) {}
}

@QueryHandler(GetCommentQuery)
export class GetCommentQueryHandler implements IQueryHandler<GetCommentQuery, CommentViewDto> {
  constructor(private readonly commentQueryRepository: CommentsQueryRepository) {}

  async execute({ commentId, user }: GetCommentQuery): Promise<CommentViewDto> {
    return this.commentQueryRepository.getByIdOrNotFoundFail(commentId, user);
  }
}
