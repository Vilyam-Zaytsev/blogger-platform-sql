import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { BlogInputDto } from './input-dto/blog-input.dto';
import { BlogViewDto } from './view-dto/blog-view.dto';
import { BasicAuthGuard } from '../../../user-accounts/auth/domain/guards/basic/basic-auth.guard';
import { BlogsQueryRepository } from '../infrastructure/query/blogs.query-repository';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { CreateBlogCommand } from '../application/usecases/create-blog.usecase';
import { GetBlogsQueryParams } from './input-dto/get-blogs-query-params.input-dto';
import { PaginatedViewDto } from '../../../../core/dto/paginated.view-dto';
import { GetBlogsQuery } from '../application/queries/get-blogs.query-handler';
import { IdInputDto } from '../../../../core/dto/id.input-dto';
import { GetBlogQuery } from '../application/queries/get-blog.query-handler';
import { UpdateBlogCommand } from '../application/usecases/update-blog.usecase';
import { UpdateBlogDto } from '../dto/update-blog.dto';
import { DeleteBlogCommand } from '../application/usecases/delete-blog.usecase';
import { CreateBlogDto } from '../dto/create-blog.dto';
import { PostInputDto } from '../../posts/api/input-dto/post-input.dto';
import { PostViewDto } from '../../posts/api/view-dto/post-view.dto';
import { CreatePostDto } from '../../posts/dto/create-post.dto';
import { CreatePostCommand } from '../../posts/application/usecases/create-post.usecase';
import { PostsQueryRepository } from '../../posts/infrastructure/query/posts.query-repository';

@Controller('sa/blogs')
@UseGuards(BasicAuthGuard)
export class BlogsAdminController {
  constructor(
    private readonly blogsQueryRepository: BlogsQueryRepository,
    private readonly postsQueryRepository: PostsQueryRepository,
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}
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

  @Post()
  async createBlog(@Body() body: BlogInputDto): Promise<BlogViewDto> {
    const dto: CreateBlogDto = new CreateBlogDto(
      body.name,
      body.description,
      body.websiteUrl,
    );
    const idCreatedBlog: number = await this.commandBus.execute(
      new CreateBlogCommand(dto),
    );

    return this.blogsQueryRepository.getByIdOrNotFoundFail(idCreatedBlog);
  }

  @Post(':blogId/posts')
  async createPostForBlog(
    @Param('blogId', ParseIntPipe) blogId: number,
    @Body() { title, shortDescription, content }: PostInputDto,
  ): Promise<PostViewDto> {
    const dto: CreatePostDto = new CreatePostDto(
      title,
      shortDescription,
      content,
      blogId,
    );

    const idCreatedPost: number = await this.commandBus.execute(
      new CreatePostCommand(dto),
    );

    return this.postsQueryRepository.getByIdOrNotFoundFail(idCreatedPost, null);
  }

  @Put(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async updateBlog(
    @Param() params: IdInputDto,
    @Body() body: BlogInputDto,
  ): Promise<void> {
    const dto: UpdateBlogDto = new UpdateBlogDto(
      params.id,
      body.name,
      body.description,
      body.websiteUrl,
    );

    await this.commandBus.execute(new UpdateBlogCommand(dto));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteBlog(@Param() params: IdInputDto): Promise<void> {
    await this.commandBus.execute(new DeleteBlogCommand(params.id));
  }
}
