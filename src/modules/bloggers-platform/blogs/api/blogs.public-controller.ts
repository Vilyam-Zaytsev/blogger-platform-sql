import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { BlogViewDto } from './view-dto/blog-view.dto';
import { QueryBus } from '@nestjs/cqrs';
import { GetBlogsQueryParams } from './input-dto/get-blogs-query-params.input-dto';
import { PaginatedViewDto } from '../../../../core/dto/paginated.view-dto';
import { GetBlogsQuery } from '../application/queries/get-blogs.query-handler';
import { IdInputDto } from '../../../../core/dto/id.input-dto';
import { GetBlogQuery } from '../application/queries/get-blog.query-handler';
import { OptionalJwtAuthGuard } from '../../../user-accounts/auth/domain/guards/bearer/optional-jwt-auth.guard';
import { ExtractUserIfExistsFromRequest } from '../../../user-accounts/auth/domain/guards/decorators/extract-user-if-exists-from-request.decorator';
import { UserContextDto } from '../../../user-accounts/auth/domain/guards/dto/user-context.dto';
import { GetPostsQueryParams } from '../../posts/api/input-dto/get-posts-query-params.input-dto';
import { PostViewDto } from '../../posts/api/view-dto/post-view.dto';
import { GetPostsForBlogQuery } from '../../posts/application/queries/get-posts-for-blog.query-handler';

@Controller('blogs')
export class BlogsPublicController {
  constructor(private readonly queryBus: QueryBus) {}
  @Get()
  async getAllBogs(
    @Query() query: GetBlogsQueryParams,
  ): Promise<PaginatedViewDto<BlogViewDto>> {
    return this.queryBus.execute(new GetBlogsQuery(query));
  }

  @Get(':id')
  async getBlogById(@Param() params: IdInputDto): Promise<BlogViewDto> {
    return this.queryBus.execute(new GetBlogQuery(params.id));
  }

  @Get(':blogId/posts')
  @UseGuards(OptionalJwtAuthGuard)
  async getPostsForBlog(
    @ExtractUserIfExistsFromRequest() user: UserContextDto | null,
    @Param('blogId', ParseIntPipe) blogId: number,
    @Query() query: GetPostsQueryParams,
  ): Promise<PaginatedViewDto<PostViewDto>> {
    return this.queryBus.execute(new GetPostsForBlogQuery(query, user, blogId));
  }
}
