import {
  Body,
  Controller,
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
import { JwtAuthGuard } from '../../../user-accounts/auth/domain/guards/bearer/jwt-auth.guard';
import { ExtractUserFromRequest } from '../../../user-accounts/auth/domain/guards/decorators/extract-user-from-request.decorator';
import { CommentInputDto } from '../../comments/api/input-dto/comment-input.dto';
import { CommentViewDto } from '../../comments/api/view-dto/comment-view.dto';
import { CreateCommentDto } from '../../comments/dto/create-comment.dto';
import { CreateCommentCommand } from '../../comments/application/usecases/create-comment.usecase';
import { CommentsQueryRepository } from '../../comments/infrastructure/query/comments.query-repository';
import { GetCommentsQueryParams } from '../../comments/api/input-dto/get-comments-query-params.input-dto';
import { GetCommentsQuery } from '../../comments/application/queries/get-comments.query-handler';
import { ReactionInputDto } from '../../reactions/api/input-dto/reaction-input.dto';
import { UpdateReactionDto } from '../../reactions/dto/update-reaction.dto';
import { UpdatePostReactionCommand } from '../application/usecases/update-post-reaction.usecase';

@Controller('posts')
export class PostsController {
  constructor(
    private readonly postsQueryRepository: PostsQueryRepository,
    private readonly commentsQueryRepository: CommentsQueryRepository,
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  // 🔸 Posts:

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

  // 🔸 Comments:

  @Post(':postId/comments')
  @UseGuards(JwtAuthGuard)
  async createComment(
    @ExtractUserFromRequest() user: UserContextDto,
    @Param('postId', ParseIntPipe) postId: number,
    @Body() body: CommentInputDto,
  ): Promise<CommentViewDto> {
    const createCommentDto: CreateCommentDto = {
      postId,
      userId: user.id,
      content: body.content,
    };

    const commentId: number = await this.commandBus.execute(
      new CreateCommentCommand(createCommentDto),
    );

    return this.commentsQueryRepository.getByIdOrNotFoundFail(commentId);
  }

  @Get(':postId/comments')
  @UseGuards(OptionalJwtAuthGuard)
  async getComments(
    @ExtractUserIfExistsFromRequest() user: UserContextDto | null,
    @Param('postId', ParseIntPipe) postId: number,
    @Query() query: GetCommentsQueryParams,
  ): Promise<PaginatedViewDto<CommentViewDto>> {
    return this.queryBus.execute(
      new GetCommentsQuery({
        query,
        postId,
        userId: user ? user.id : null,
      }),
    );
  }

  // 🔸 Reactions:

  @Put(':postId/like-status')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  async updateReaction(
    @ExtractUserFromRequest() user: UserContextDto,
    @Param('postId', ParseIntPipe) postId: number,
    @Body() body: ReactionInputDto,
  ): Promise<void> {
    const updateReactionDto: UpdateReactionDto = {
      status: body.likeStatus,
      userId: user.id,
      parentId: postId,
    };

    await this.commandBus.execute(new UpdatePostReactionCommand(updateReactionDto));
  }
}
