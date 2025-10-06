import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { CommentInputDto } from './input-dto/comment-input.dto';
import { JwtAuthGuard } from '../../../user-accounts/auth/domain/guards/bearer/jwt-auth.guard';
import { ExtractUserFromRequest } from '../../../user-accounts/auth/domain/guards/decorators/extract-user-from-request.decorator';
import { UserContextDto } from '../../../user-accounts/auth/domain/guards/dto/user-context.dto';
import { CommentUpdateDto } from '../application/dto/comment.update-dto';
import { UpdateCommentCommand } from '../application/usecases/update-comment.usecase';
import { DeleteCommentCommand } from '../application/usecases/delete-comment.usecase';
import { OptionalJwtAuthGuard } from '../../../user-accounts/auth/domain/guards/bearer/optional-jwt-auth.guard';
import { ExtractUserIfExistsFromRequest } from '../../../user-accounts/auth/domain/guards/decorators/extract-user-if-exists-from-request.decorator';
import { CommentViewDto } from './view-dto/comment-view.dto';
import { GetCommentQuery } from '../application/queries/get-comment.query-handler';
import { ReactionInputDto } from '../../reactions/api/input-dto/reaction-input.dto';
import { UpdateCommentReactionCommand } from '../application/usecases/update-comment-reaction.usecase';
import { ReactionUpdateDto } from '../../reactions/dto/reaction.create-dto';

@Controller('comments')
export class CommentsController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  async getById(
    @ExtractUserIfExistsFromRequest() user: UserContextDto | null,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<CommentViewDto> {
    return await this.queryBus.execute(new GetCommentQuery(id, user));
  }

  @Put(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  async updateComment(
    @ExtractUserFromRequest() { id: userId }: UserContextDto,
    @Param('id', ParseIntPipe) commentId: number,
    @Body() { content }: CommentInputDto,
  ): Promise<void> {
    const dto: CommentUpdateDto = {
      commentId,
      userId,
      content,
    };

    await this.commandBus.execute(new UpdateCommentCommand(dto));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  async deleteComment(
    @ExtractUserFromRequest() { id: userId }: UserContextDto,
    @Param('id', ParseIntPipe) commentId: number,
  ): Promise<void> {
    await this.commandBus.execute(new DeleteCommentCommand(commentId, userId));
  }

  @Put(':commentId/like-status')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  async updateReaction(
    @ExtractUserFromRequest() user: UserContextDto,
    @Param('commentId', ParseIntPipe) commentId: number,
    @Body() body: ReactionInputDto,
  ): Promise<void> {
    const reactionUpdateDto: ReactionUpdateDto = {
      status: body.likeStatus,
      userId: user.id,
      parentId: commentId,
    };

    await this.commandBus.execute(new UpdateCommentReactionCommand(reactionUpdateDto));
  }
}
