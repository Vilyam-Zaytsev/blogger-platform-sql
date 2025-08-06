import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { PostInputDto } from './input-dto/post-input.dto';
import { PostViewDto } from './view-dto/post-view.dto';

import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { BasicAuthGuard } from '../../../user-accounts/auth/domain/guards/basic/basic-auth.guard';
import { CreatePostDto } from '../dto/create-post.dto';
import { CreatePostCommand } from '../application/usecases/create-post.usecase';
import { PostsQueryRepository } from '../infrastructure/query/posts.query-repository';

@Controller('posts')
export class PostsController {
  constructor(
    private readonly postsQueryRepository: PostsQueryRepository,
    // private readonly commentsQueryRepository: CommentsQueryRepository,
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  // @Get()
  // @UseGuards(OptionalJwtAuthGuard)
  // async getAll(
  //   @ExtractUserIfExistsFromRequest() user: UserContextDto | null,
  //   @Query() query: GetPostsQueryParams,
  // ): Promise<PaginatedViewDto<PostViewDto>> {
  //   return this.queryBus.execute(new GetPostsQuery(query, user));
  // }

  // @Get(':id')
  // @UseGuards(OptionalJwtAuthGuard)
  // async getById(
  //   @ExtractUserIfExistsFromRequest() user: UserContextDto | null,
  //   @Param() params: IdInputDto,
  // ): Promise<PostViewDto> {
  //   return this.queryBus.execute(new GetPostQuery(params.id, user));
  // }
  //
  // @Get(':postId/comments')
  // @UseGuards(OptionalJwtAuthGuard)
  // async getComments(
  //   @ExtractUserIfExistsFromRequest() user: UserContextDto | null,
  //   @Param('postId', ObjectIdValidationPipe) postId: string,
  //   @Query() query: GetCommentsQueryParams,
  // ): Promise<PaginatedViewDto<CommentViewDto>> {
  //   return this.queryBus.execute(new GetCommentsQuery(query, user, postId));
  // }
  //
  @Post()
  @UseGuards(BasicAuthGuard)
  async createPost(@Body() body: PostInputDto): Promise<PostViewDto> {
    const dto: CreatePostDto = new CreatePostDto(
      body.title,
      body.shortDescription,
      body.content,
      +body.blogId,
    );

    const idCreatedPost: number = await this.commandBus.execute(
      new CreatePostCommand(dto),
    );

    return this.postsQueryRepository.getByIdOrNotFoundFail(idCreatedPost, null);
  }

  // @Post(':postId/comments')
  // @UseGuards(JwtAuthGuard)
  // async createComment(
  //   @ExtractUserFromRequest() user: UserContextDto,
  //   @Param('postId', ObjectIdValidationPipe) postId: string,
  //   @Body() body: CommentInputDto,
  // ): Promise<CommentViewDto> {
  //   const createCommentDto: CreateCommentDto = {
  //     postId,
  //     userId: user.id,
  //     content: body.content,
  //   };
  //
  //   const commentId: string = await this.commandBus.execute(
  //     new CreateCommentCommand(createCommentDto),
  //   );
  //
  //   return this.commentsQueryRepository.getByIdOrNotFoundFail(commentId);
  // }
  //
  // @Put(':id')
  // @HttpCode(HttpStatus.NO_CONTENT)
  // @UseGuards(BasicAuthGuard)
  // async updatePost(
  //   @Param() params: IdInputDto,
  //   @Body() body: PostInputDto,
  // ): Promise<void> {
  //   await this.commandBus.execute(new UpdatePostCommand(body, params.id));
  // }
  //
  // @Put(':postId/like-status')
  // @HttpCode(HttpStatus.NO_CONTENT)
  // @UseGuards(JwtAuthGuard)
  // async updateReaction(
  //   @ExtractUserFromRequest() user: UserContextDto,
  //   @Param('postId', ObjectIdValidationPipe) postId: string,
  //   @Body() body: ReactionInputDto,
  // ): Promise<void> {
  //   const updateReactionDto: UpdateReactionDto = {
  //     status: body.likeStatus,
  //     userId: user.id,
  //     parentId: postId,
  //   };
  //
  //   await this.commandBus.execute(
  //     new UpdatePostReactionCommand(updateReactionDto),
  //   );
  // }
  //
  // @Delete(':id')
  // @HttpCode(HttpStatus.NO_CONTENT)
  // @UseGuards(BasicAuthGuard)
  // async deletePost(@Param() params: IdInputDto): Promise<void> {
  //   await this.commandBus.execute(new DeletePostCommand(params.id));
  // }
}
