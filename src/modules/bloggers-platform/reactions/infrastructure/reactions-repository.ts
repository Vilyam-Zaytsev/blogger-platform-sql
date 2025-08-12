import { Inject, Injectable } from '@nestjs/common';
import { PG_POOL } from '../../../database/constants/database.constants';
import { Pool, QueryResult } from 'pg';
import { PostReactionDbType } from '../types/reaction-db.type';

@Injectable()
export class ReactionsRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

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
