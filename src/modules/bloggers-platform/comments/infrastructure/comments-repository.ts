import { Injectable } from '@nestjs/common';
import { UpdateCommentContentDto } from './dto/update-comment-content.dto';
import { ReactionDb, ReactionStatus } from '../../reactions/types/reaction-db.type';
import { ReactionCreateDto } from '../../reactions/dto/reaction.create-dto';
import { BaseRepository } from '../../../../core/repositories/base.repository';
import { Comment } from '../domain/entities/comment.entity';
import { DataSource } from 'typeorm';

@Injectable()
export class CommentsRepository extends BaseRepository<Comment> {
  constructor(dataSource: DataSource) {
    super(dataSource, Comment);
  }

  async update(dto: UpdateCommentContentDto): Promise<void> {}

  // 🔸 Reactions:

  async createReaction(dto: ReactionCreateDto): Promise<void> {}

  async updateStatusPostReaction(reactionId: number, newStatus: ReactionStatus): Promise<void> {}

  async getReactionByUserIdAndCommentId(
    userId: number,
    commentId: number,
  ): Promise<ReactionDb | null> {
    return {} as ReactionDb;
  }
}
