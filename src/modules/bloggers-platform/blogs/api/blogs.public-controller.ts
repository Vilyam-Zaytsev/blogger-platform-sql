import { Controller, Get, Param, Query } from '@nestjs/common';
import { BlogViewDto } from './view-dto/blog-view.dto';
import { QueryBus } from '@nestjs/cqrs';
import { GetBlogsQueryParams } from './input-dto/get-blogs-query-params.input-dto';
import { PaginatedViewDto } from '../../../../core/dto/paginated.view-dto';
import { GetBlogsQuery } from '../application/queries/get-blogs.query-handler';
import { IdInputDto } from '../../../../core/dto/id.input-dto';
import { GetBlogQuery } from '../application/queries/get-blog.query-handler';

@Controller('blogs')
export class BlogsPublicController {
  constructor(private readonly queryBus: QueryBus) {}
  @Get()
  async getAll(
    @Query() query: GetBlogsQueryParams,
  ): Promise<PaginatedViewDto<BlogViewDto>> {
    return this.queryBus.execute(new GetBlogsQuery(query));
  }

  @Get(':id')
  async getById(@Param() params: IdInputDto): Promise<BlogViewDto> {
    return this.queryBus.execute(new GetBlogQuery(params.id));
  }

  // @Get(':blogId/posts')
  // @UseGuards(OptionalJwtAuthGuard)
  // async getPostsForBlog(
  //   @ExtractUserIfExistsFromRequest() user: UserContextDto | null,
  //   @Param('blogId', ObjectIdValidationPipe) blogId: string,
  //   @Query() query: GetPostsQueryParams,
  // ): Promise<PaginatedViewDto<PostViewDto>> {
  //   return this.queryBus.execute(new GetPostsForBlogQuery(query, user, blogId));
  // }
}
