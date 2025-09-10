import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PaginatedViewDto } from '../../../../../core/dto/paginated.view-dto';
import { GetPostsQueryParams } from '../../api/input-dto/get-posts-query-params.input-dto';
import { UserContextDto } from '../../../../user-accounts/auth/domain/guards/dto/user-context.dto';
import { PostViewDto } from '../../api/view-dto/post.view-dto';
import { PostsQueryRepository } from '../../infrastructure/query/posts.query-repository';
import { BlogsRepository } from '../../../blogs/infrastructure/blogs.repository';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';
import { BlogDb } from '../../../blogs/types/blog-db.type';

export class GetPostsForBlogQuery {
  constructor(
    public readonly queryParams: GetPostsQueryParams,
    public readonly user: UserContextDto | null,
    public readonly blogId: number,
  ) {}
}

@QueryHandler(GetPostsForBlogQuery)
export class GetPostsForBlogQueryHandler
  implements IQueryHandler<GetPostsForBlogQuery, PaginatedViewDto<PostViewDto>>
{
  constructor(
    private readonly postsQueryRepository: PostsQueryRepository,
    private readonly blogsRepository: BlogsRepository,
  ) {}

  async execute({
    queryParams,
    user,
    blogId,
  }: GetPostsForBlogQuery): Promise<PaginatedViewDto<PostViewDto>> {
    const blog: BlogDb | null = await this.blogsRepository.getById(blogId);

    if (!blog) {
      throw new DomainException({
        code: DomainExceptionCode.NotFound,
        message: `The blog with ID (${blogId}) does not exist`,
      });
    }

    return this.postsQueryRepository.getAll(queryParams, user, blogId);
  }
}
