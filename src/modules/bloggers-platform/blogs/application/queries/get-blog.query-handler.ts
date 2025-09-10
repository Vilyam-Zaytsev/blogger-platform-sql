import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { BlogsQueryRepository } from '../../infrastructure/query/blogs.query-repository';
import { BlogViewDto } from '../../api/view-dto/blog.view-dto';

export class GetBlogQuery {
  constructor(public readonly id: number) {}
}

@QueryHandler(GetBlogQuery)
export class GetBlogQueryHandler implements IQueryHandler<GetBlogQuery, BlogViewDto> {
  constructor(private readonly blogsQueryRepository: BlogsQueryRepository) {}

  async execute({ id }: GetBlogQuery): Promise<BlogViewDto> {
    return this.blogsQueryRepository.getByIdOrNotFoundFail(id);
  }
}
