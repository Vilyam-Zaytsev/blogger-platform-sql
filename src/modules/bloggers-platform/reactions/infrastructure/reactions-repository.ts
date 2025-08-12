import { Inject, Injectable } from '@nestjs/common';
import { PG_POOL } from '../../../database/constants/database.constants';
import { Pool, QueryResult } from 'pg';
import { PostReactionDbType, ReactionStatus } from '../types/reaction-db.type';
import { CreateReactionDto } from '../dto/create-reaction.dto';

@Injectable()
export class ReactionsRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}
  async insertReaction(dto: CreateReactionDto): Promise<number> {
    const { rows }: QueryResult<{ id: number }> = await this.pool.query(
      `
      INSERT INTO "PostsReactions" ("status", "userId", "postId")
      VALUES ($1, $2, $3) RETURNING "id"
      `,
      [dto.status, dto.userId, dto.parentId],
    );

    return rows[0].id;
  }

  async updateStatusPostReaction(reactionId: number, newStatus: ReactionStatus): Promise<boolean> {
    const { rowCount }: QueryResult = await this.pool.query(
      `
      UPDATE "PostsReactions"
      SET "status" = $1
      WHERE "id" = $2
      `,
      [newStatus, reactionId],
    );

    return (rowCount ?? 0) > 0;
  }
  // async getByIdOrNotFoundFail(id: string): Promise<ReactionDocument> {
  //   const reaction: ReactionDocument | null = await this.ReactionModel.findOne({
  //     _id: id,
  //     deletedAt: null,
  //   });
  //
  //   if (!reaction) {
  //     throw new DomainException({
  //       code: DomainExceptionCode.NotFound,
  //       message: `The reaction with ID (${id}) does not exist`,
  //     });
  //   }
  //
  //   return reaction;
  // }
  //
  async getByUserIdAndPostId(userId: number, postId: number): Promise<PostReactionDbType | null> {
    const { rows }: QueryResult<PostReactionDbType> = await this.pool.query(
      `
          SELECT *
          FROM "PostsReactions"
          WHERE "userId" = $1
            AND "postId" = $2
            AND "deletedAt" IS NULL
      `,
      [userId, postId],
    );

    return rows[0];
  }

  // async getByParentIds(parentIds: string[]): Promise<ReactionDocument[]> {
  //   return this.ReactionModel.find({
  //     parentId: { $in: parentIds },
  //   });
  // }
  //
  // async getRecentLikes(parentId: string): Promise<ReactionDocument[]> {
  //   const filter = {
  //     status: ReactionStatus.Like,
  //     parentId,
  //   };
  //
  //   return await this.ReactionModel.find(filter).sort({ createdAt: -1 }).limit(3).exec();
  // }
  //
  // async save(reaction: ReactionDocument): Promise<string> {
  //   const resultSave: ReactionDocument = await reaction.save();
  //
  //   return resultSave._id.toString();
  // }
}
