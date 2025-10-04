import { Injectable } from '@nestjs/common';
import { UpdateCommentContentDto } from './dto/update-comment-content.dto';
import { CreateCommentDomainDto } from '../domain/dto/create-comment.domain-dto';
import { ReactionDb, ReactionStatus } from '../../reactions/types/reaction-db.type';
import { ReactionCreateDto } from '../../reactions/dto/reaction.create-dto';
import { CommentDb } from '../types/comment-db.type';

@Injectable()
export class CommentsRepository {
  constructor() {}
  async save(): Promise<number> {
    return 1;
  }

  async softDelete(id: number): Promise<void> {}

  async getById(id: number): Promise<CommentDb | null> {
    return id < 2 ? ({} as CommentDb) : null;
  }
  // 🔸 Comments:

  async create(dto: CreateCommentDomainDto): Promise<number> {
    return 1;
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

// export class CommentsRepository extends BaseRepository<
//   CommentDb,
//   CreateCommentDomainDto,
//   UpdateCommentContentDto
// > {
//   constructor(@Inject(PG_POOL) pool: Pool) {
//     super(pool, 'Comments');
//   }
//
//   // 🔸 Comments:
//
//   async create(types: CreateCommentDomainDto): Promise<number> {
//     const query = `
//       INSERT INTO "Comments" ("postId", "commentatorId", "content")
//       VALUES ($1, $2, $3) RETURNING "id";
//     `;
//
//     const { rows }: QueryResult<{ id: number }> = await this.pool.query(query, [
//       types.postId,
//       types.commentatorId,
//       types.content,
//     ]);
//
//     return rows[0].id;
//   }
//// export class CommentsRepository extends BaseRepository<
//   CommentDb,
//   CreateCommentDomainDto,
//   UpdateCommentContentDto
// > {
//   constructor(@Inject(PG_POOL) pool: Pool) {
//     super(pool, 'Comments');
//   }
//
//   // 🔸 Comments:
//
//   async create(types: CreateCommentDomainDto): Promise<number> {
//     const query = `
//       INSERT INTO "Comments" ("postId", "commentatorId", "content")
//       VALUES ($1, $2, $3) RETURNING "id";
//     `;
//
//     const { rows }: QueryResult<{ id: number }> = await this.pool.query(query, [
//       types.postId,
//       types.commentatorId,
//       types.content,
//     ]);
//
//     return rows[0].id;
//   }
//
//   async update(types: UpdateCommentContentDto): Promise<void> {
//     const query = `
//       UPDATE "Comments"
//       SET "content" = $1
//       WHERE "id" = $2
//     `;
//
//     await this.pool.query(query, [types.content, types.commentId]);
//   }
//
//   // 🔸 Reactions:
//
//   async createReaction(types: CreateReactionDto): Promise<void> {
//     const query = `
//       INSERT INTO "CommentsReactions" ("status", "userId", "commentId")
//       VALUES ($1, $2, $3)
//     `;
//
//     await this.pool.query(query, [types.status, types.userId, types.parentId]);
//   }
//
//   async updateStatusPostReaction(reactionId: number, newStatus: ReactionStatus): Promise<void> {
//     const query = `
//       UPDATE "CommentsReactions"
//       SET "status" = $1
//       WHERE "id" = $2
//     `;
//
//     await this.pool.query(query, [newStatus, reactionId]);
//   }
//
//   async getReactionByUserIdAndCommentId(
//     userId: number,
//     commentId: number,
//   ): Promise<ReactionDb | null> {
//     const query = `
//       SELECT *
//       FROM "CommentsReactions"
//       WHERE "userId" = $1
//         AND "commentId" = $2
//     `;
//     const { rows }: QueryResult<ReactionDb> = await this.pool.query(query, [userId, commentId]);
//
//     return rows[0] || null;
//   }

//   async update(types: UpdateCommentContentDto): Promise<void> {
//     const query = `
//       UPDATE "Comments"
//       SET "content" = $1
//       WHERE "id" = $2
//     `;
//
//     await this.pool.query(query, [types.content, types.commentId]);
//   }
//
//   // 🔸 Reactions:
//
//   async createReaction(types: CreateReactionDto): Promise<void> {
//     const query = `
//       INSERT INTO "CommentsReactions" ("status", "userId", "commentId")
//       VALUES ($1, $2, $3)
//     `;
//
//     await this.pool.query(query, [types.status, types.userId, types.parentId]);
//   }
//
//   async updateStatusPostReaction(reactionId: number, newStatus: ReactionStatus): Promise<void> {
//     const query = `
//       UPDATE "CommentsReactions"
//       SET "status" = $1
//       WHERE "id" = $2
//     `;
//
//     await this.pool.query(query, [newStatus, reactionId]);
//   }
//
//   async getReactionByUserIdAndCommentId(
//     userId: number,
//     commentId: number,
//   ): Promise<ReactionDb | null> {
//     const query = `
//       SELECT *
//       FROM "CommentsReactions"
//       WHERE "userId" = $1
//         AND "commentId" = $2
//     `;
//     const { rows }: QueryResult<ReactionDb> = await this.pool.query(query, [userId, commentId]);
//
//     return rows[0] || null;
//   }
// }
