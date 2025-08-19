import { Inject, Injectable } from '@nestjs/common';
import { PG_POOL } from '../../../database/constants/database.constants';
import { Pool, QueryResult } from 'pg';
import { PostDb } from '../types/post-db.type';
import { CreatePostDto } from '../dto/create-post.dto';
import { UpdatePostDto } from '../dto/update-post.dto';
import { BaseRepository } from '../../../../core/repositories/base.repository';
import { ReactionDb, ReactionStatus } from '../../reactions/types/reaction-db.type';
import { CreateReactionDto } from '../../reactions/dto/create-reaction.dto';

@Injectable()
export class PostsRepository extends BaseRepository<PostDb, CreatePostDto, UpdatePostDto> {
  constructor(@Inject(PG_POOL) pool: Pool) {
    super(pool, 'Posts');
  }

  // 🔸 Posts:

  async create(dto: CreatePostDto): Promise<number> {
    const query = `
      INSERT INTO "Posts" ("title", "shortDescription", "content", "blogId")
      VALUES ($1, $2, $3, $4) RETURNING "id"
    `;

    const { rows }: QueryResult<PostDb> = await this.pool.query(query, [
      dto.title,
      dto.shortDescription,
      dto.content,
      dto.blogId,
    ]);

    return rows[0].id;
  }

  async update(dto: UpdatePostDto): Promise<void> {
    const query = `
      UPDATE "Posts"
      SET "title"            = $1,
          "shortDescription" = $2,
          "content"          = $3
      WHERE "id" = $4
    `;

    await this.pool.query(query, [dto.title, dto.shortDescription, dto.content, dto.postId]);
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
