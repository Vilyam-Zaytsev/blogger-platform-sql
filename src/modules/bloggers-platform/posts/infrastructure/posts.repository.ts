import { Injectable } from '@nestjs/common';
import { QueryResult } from 'pg';
import { ReactionDb, ReactionStatus } from '../../reactions/types/reaction-db.type';
import { CreateReactionDto } from '../../reactions/dto/create-reaction.dto';
import { Post } from '../domain/entities/post.entity';
import { BaseRepository } from '../../../../core/repositories/base.repository';
import { DataSource } from 'typeorm';

@Injectable()
export class PostsRepository extends BaseRepository<Post> {
  pool: any = {};
  constructor(dataSource: DataSource) {
    super(dataSource, Post);
  }
  // 🔸 Reactions:

  async createReaction(dto: CreateReactionDto): Promise<void> {
    const query = `
      INSERT INTO "PostsReactions" ("status", "userId", "postId")
      VALUES ($1, $2, $3)
    `;

    await this.pool.query(query, [dto.status, dto.userId, dto.parentId]);
  }

  async updateStatusPostReaction(reactionId: number, newStatus: ReactionStatus): Promise<void> {
    const query = `
      UPDATE "PostsReactions"
      SET "status" = $1
      WHERE "id" = $2
    `;

    await this.pool.query(query, [newStatus, reactionId]);
  }

  async getReactionByUserIdAndPostId(userId: number, postId: number): Promise<ReactionDb | null> {
    const query = `
      SELECT *
      FROM "PostsReactions"
      WHERE "userId" = $1
        AND "postId" = $2
    `;
    const { rows }: QueryResult<ReactionDb> = await this.pool.query(query, [userId, postId]);

    return rows[0] || null;
  }
}
