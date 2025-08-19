import { Inject, Injectable } from '@nestjs/common';
import { PG_POOL } from '../../../database/constants/database.constants';
import { Pool, QueryResult } from 'pg';
import { CommentDb } from '../types/comment-db.type';
import { UpdateCommentContentDto } from './dto/update-comment-content.dto';
import { CreateCommentDomainDto } from '../domain/dto/create-comment.domain-dto';
import { BaseRepository } from '../../../../core/repositories/base.repository';
import { ReactionDb, ReactionStatus } from '../../reactions/types/reaction-db.type';
import { CreateReactionDto } from '../../reactions/dto/create-reaction.dto';

@Injectable()
export class CommentsRepository extends BaseRepository<
  CommentDb,
  CreateCommentDomainDto,
  UpdateCommentContentDto
> {
  constructor(@Inject(PG_POOL) pool: Pool) {
    super(pool, 'Comments');
  }

  // 🔸 Comments:

  async create(dto: CreateCommentDomainDto): Promise<number> {
    const query = `
      INSERT INTO "Comments" ("postId", "commentatorId", "content")
      VALUES ($1, $2, $3) RETURNING "id";
    `;

    const { rows }: QueryResult<{ id: number }> = await this.pool.query(query, [
      dto.postId,
      dto.commentatorId,
      dto.content,
    ]);

    return rows[0].id;
  }

  async update(dto: UpdateCommentContentDto): Promise<void> {
    const query = `
      UPDATE "Comments"
      SET "content" = $1
      WHERE "id" = $2
    `;

    await this.pool.query(query, [dto.content, dto.commentId]);
  }

  // 🔸 Reactions:

  async createReaction(dto: CreateReactionDto): Promise<void> {
    const query = `
      INSERT INTO "CommentsReactions" ("status", "userId", "commentId")
      VALUES ($1, $2, $3)
    `;

    await this.pool.query(query, [dto.status, dto.userId, dto.parentId]);
  }

  async updateStatusPostReaction(reactionId: number, newStatus: ReactionStatus): Promise<void> {
    const query = `
      UPDATE "CommentsReactions"
      SET "status" = $1
      WHERE "id" = $2
    `;

    await this.pool.query(query, [newStatus, reactionId]);
  }

  async getReactionByUserIdAndCommentId(
    userId: number,
    commentId: number,
  ): Promise<ReactionDb | null> {
    const query = `
      SELECT *
      FROM "CommentsReactions"
      WHERE "userId" = $1
        AND "commentId" = $2
    `;
    const { rows }: QueryResult<ReactionDb> = await this.pool.query(query, [userId, commentId]);

    return rows[0] || null;
  }
}
