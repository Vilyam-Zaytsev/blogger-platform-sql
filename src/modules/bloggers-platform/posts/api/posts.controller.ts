import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';

import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { PostsQueryRepository } from '../infrastructure/query/posts.query-repository';
import { OptionalJwtAuthGuard } from '../../../user-accounts/auth/domain/guards/bearer/optional-jwt-auth.guard';
import { ExtractUserIfExistsFromRequest } from '../../../user-accounts/auth/domain/guards/decorators/extract-user-if-exists-from-request.decorator';
import { UserContextDto } from '../../../user-accounts/auth/domain/guards/dto/user-context.dto';
import { GetPostsQueryParams } from './input-dto/get-posts-query-params.input-dto';
import { PaginatedViewDto } from '../../../../core/dto/paginated.view-dto';
import { PostViewDto } from './view-dto/post-view.dto';
import { GetPostsQuery } from '../application/queries/get-posts.query-handler';
import { GetPostQuery } from '../application/queries/get-post.query-handler';

@Controller('posts')
export class PostsController {
  constructor(
    private readonly postsQueryRepository: PostsQueryRepository,
    // private readonly commentsQueryRepository: CommentsQueryRepository,
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  async getAllPosts(
    @ExtractUserIfExistsFromRequest() user: UserContextDto | null,
    @Query() query: GetPostsQueryParams,
  ): Promise<PaginatedViewDto<PostViewDto>> {
    return this.queryBus.execute(new GetPostsQuery(query, user));
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  async getPostById(
    @ExtractUserIfExistsFromRequest() user: UserContextDto | null,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<PostViewDto> {
    return this.queryBus.execute(new GetPostQuery(id, user));
  }

  // @Get(':postId/comments')
  // @UseGuards(OptionalJwtAuthGuard)
  // async getComments(
  //   @ExtractUserIfExistsFromRequest() user: UserContextDto | null,
  //   @Param('postId', ObjectIdValidationPipe) postId: string,
  //   @Query() query: GetCommentsQueryParams,
  // ): Promise<PaginatedViewDto<CommentViewDto>> {
  //   return this.queryBus.execute(new GetCommentsQuery(query, user, postId));
  // }

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
