import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { BlogInputDto } from './input-dto/blog-input.dto';
import { BlogViewDto } from './view-dto/blog-view.dto';
import { BasicAuthGuard } from '../../../user-accounts/auth/domain/guards/basic/basic-auth.guard';
import { BlogsQueryRepository } from '../infrastructure/query/blogs.query-repository';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { CreateBlogCommand } from '../application/usecases/create-blog.usecase';

@Controller('sa/blogs')
@UseGuards(BasicAuthGuard)
export class BlogsController {
  constructor(
    private readonly blogsQueryRepository: BlogsQueryRepository,
    // private readonly postsQueryRepository: PostsQueryRepository,
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}
  // @Get()
  // @Public()
  // async getAll(
  //   @Query() query: GetBlogsQueryParams,
  // ): Promise<PaginatedViewDto<BlogViewDto>> {
  //   return this.queryBus.execute(new GetBlogsQuery(query));
  // }
  // query;

  // @Get(':id')
  // @Public()
  // async getById(@Param() params: IdInputDto): Promise<BlogViewDto> {
  //   return this.queryBus.execute(new GetBlogQuery(params.id));
  // }
  //
  // @Get(':blogId/posts')
  // @UseGuards(OptionalJwtAuthGuard)
  // @Public()
  // async getPostsForBlog(
  //   @ExtractUserIfExistsFromRequest() user: UserContextDto | null,
  //   @Param('blogId', ObjectIdValidationPipe) blogId: string,
  //   @Query() query: GetPostsQueryParams,
  // ): Promise<PaginatedViewDto<PostViewDto>> {
  //   return this.queryBus.execute(new GetPostsForBlogQuery(query, user, blogId));
  // }

  @Post()
  async createBlog(@Body() body: BlogInputDto): Promise<BlogViewDto> {
    const idCreatedBlog: number = await this.commandBus.execute(
      new CreateBlogCommand(body),
    );

    return this.blogsQueryRepository.getByIdOrNotFoundFail(idCreatedBlog);
  }

  // @Post(':blogId/posts')
  // async createPostForBlog(
  //   @Param('blogId', ObjectIdValidationPipe) blogId: string,
  //   @Body() body: CreatePostForBlogInputDto,
  // ): Promise<PostViewDto> {
  //   const createPostDto: CreatePostDto = {
  //     ...body,
  //     blogId,
  //   };
  //
  //   const postId: string = await this.commandBus.execute(
  //     new CreatePostCommand(createPostDto),
  //   );
  //
  //   return this.postsQueryRepository.getByIdOrNotFoundFail(postId);
  // }
  //
  // @Put(':id')
  // @HttpCode(HttpStatus.NO_CONTENT)
  // async updateBlog(
  //   @Param() params: IdInputDto,
  //   @Body() body: BlogInputDto,
  // ): Promise<void> {
  //   await this.commandBus.execute(new UpdateBlogCommand(body, params.id));
  // }
  //
  // @Delete(':id')
  // @HttpCode(HttpStatus.NO_CONTENT)
  // async deleteBlog(@Param() params: IdInputDto): Promise<void> {
  //   await this.commandBus.execute(new DeleteBlogCommand(params.id));
  // }
}
