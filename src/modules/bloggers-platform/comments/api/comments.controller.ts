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
import { UpdateCommentDto } from '../dto/update-comment.dto';
import { UpdateCommentCommand } from '../application/usecases/update-comment.usecase';
import { DeleteCommentCommand } from '../application/usecases/delete-comment.usecase';

@Controller('comments')
export class CommentsController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @Put(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  async updateComment(
    @ExtractUserFromRequest() user: UserContextDto,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CommentInputDto,
  ): Promise<void> {
    const dto: UpdateCommentDto = new UpdateCommentDto(
      id,
      user.id,
      body.content,
    );

    await this.commandBus.execute(new UpdateCommentCommand(dto));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  async deletePost(
    @ExtractUserFromRequest() user: UserContextDto,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    await this.commandBus.execute(
      new DeleteCommentCommand({
        commentId: id,
        userId: user.id,
      }),
    );
  }

  // @Get(':id')
  // @UseGuards(OptionalJwtAuthGuard)
  // async getById(
  //   @ExtractUserIfExistsFromRequest() user: UserContextDto | null,
  //   @Param() params: IdInputDto,
  // ): Promise<CommentViewDto> {
  //   return this.queryBus.execute(new GetCommentQuery(params.id, user));
  // }
  //
  // @Put(':commentId/like-status')
  // @HttpCode(HttpStatus.NO_CONTENT)
  // @UseGuards(JwtAuthGuard)
  // async updateReaction(
  //   @ExtractUserFromRequest() user: UserContextDto,
  //   @Param('commentId', ObjectIdValidationPipe) commentId: string,
  //   @Body() body: ReactionInputDto,
  // ): Promise<void> {
  //   const updateReactionDto: UpdateReactionDto = {
  //     status: body.likeStatus,
  //     userId: user.id,
  //     parentId: commentId,
  //   };
  //
  //   await this.commandBus.execute(
  //     new UpdateCommentReactionCommand(updateReactionDto),
  //   );
  // }
  //
}
