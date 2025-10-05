import { Injectable } from '@nestjs/common';
import { CommentViewDto } from '../../api/view-dto/comment-view.dto';
import { CommentsQueryDto } from '../../dto/comments-query.dto';
import { PaginatedViewDto } from '../../../../../core/dto/paginated.view-dto';
import { UserContextDto } from '../../../../user-accounts/auth/domain/guards/dto/user-context.dto';

@Injectable()
export class CommentsQueryRepository {
  constructor() {}

  async getByIdOrNotFoundFail(id: number, user: UserContextDto | null): Promise<CommentViewDto> {
    return {} as CommentViewDto;
    // const {
    //   rows,
    // }: QueryResult<{
    //   id: string;
    //   content: string;
    //   commentatorInfo: { userId: string; userLogin: string };
    //   likesInfo: { likesCount: number; dislikesCount: number; myStatus: ReactionStatus };
    //   createdAt: string | Date;
    // }> = await this.pool.query(
    //   `
    //     WITH "LikesCount" AS (
    //       SELECT "commentId", COUNT(*) AS "count"
    //       FROM "CommentsReactions"
    //       WHERE "status" = 'Like'
    //       GROUP BY "commentId"
    //     ),
    //          "DislikesCount" AS (
    //            SELECT "commentId", COUNT(*) AS "count"
    //            FROM "CommentsReactions"
    //            WHERE "status" = 'Dislike'
    //            GROUP BY "commentId"
    //          )
    //     SELECT
    //       c."id"::text AS "id",
    //       c."content" AS "content",
    //       json_build_object(
    //         'userId', c."commentatorId"::text,
    //         'userLogin', u."login"
    //       ) AS "commentatorInfo",
    //       c."createdAt" AS "createdAt",
    //       json_build_object(
    //         'likesCount', COALESCE(lc.count, 0),
    //         'dislikesCount', COALESCE(dc.count, 0),
    //         'myStatus', COALESCE(cr."status", 'None')
    //       ) AS "likesInfo"
    //     FROM "Comments" c
    //            JOIN "Users" u ON u."id" = c."commentatorId"
    //            LEFT JOIN "LikesCount" lc ON lc."commentId" = c."id"
    //            LEFT JOIN "DislikesCount" dc ON dc."commentId" = c."id"
    //            LEFT JOIN "CommentsReactions" cr ON cr."commentId" = c."id" AND cr."userId" = $2
    //     WHERE c."id" = $1
    //       AND c."deletedAt" IS NULL
    //   `,
    //   [id, user ?? null],
    // );
    //
    // if (rows.length === 0) {
    //   throw new DomainException({
    //     code: DomainExceptionCode.NotFound,
    //     message: `The comment with ID (${id}) does not exist`,
    //   });
    // }
    //
    // const row = rows[0];
    //
    // return {
    //   id: row.id,
    //   content: row.content,
    //   commentatorInfo: {
    //     userId: row.commentatorInfo.userId,
    //     userLogin: row.commentatorInfo.userLogin,
    //   },
    //   likesInfo: {
    //     likesCount: row.likesInfo.likesCount,
    //     dislikesCount: row.likesInfo.dislikesCount,
    //     myStatus: row.likesInfo.myStatus,
    //   },
    //   createdAt: new Date(row.createdAt).toISOString(),
    // };
  }

  async getAll(dto: CommentsQueryDto): Promise<PaginatedViewDto<CommentViewDto>> {
    // const { sortBy, sortDirection, pageSize, pageNumber }: GetCommentsQueryParams = dto.query;
    //
    // if (!Object.values(CommentsSortBy).includes(sortBy)) {
    //   throw new ValidationException([
    //     {
    //       message: `Invalid sortBy: ${sortBy}`,
    //       field: 'sortBy',
    //     },
    //   ]);
    // }
    //
    // if (!Object.values(SortDirection).includes(sortDirection)) {
    //   throw new ValidationException([
    //     {
    //       message: `Invalid sortDirection: ${sortDirection}`,
    //       field: 'sortDirection',
    //     },
    //   ]);
    // }
    //
    // const offset: number = dto.query.calculateSkip();
    //
    // const { rows }: QueryResult<CommentRawRow> = await this.pool.query(
    //   `
    //     WITH "LikesCount" AS (
    //       SELECT "commentId", COUNT(*) AS "count"
    //       FROM "CommentsReactions"
    //       WHERE "status" = 'Like'
    //       GROUP BY "commentId"
    //     ),
    //          "DislikesCount" AS (
    //            SELECT "commentId", COUNT(*) AS "count"
    //            FROM "CommentsReactions"
    //            WHERE "status" = 'Dislike'
    //            GROUP BY "commentId"
    //          )
    //     SELECT
    //       COUNT(*) OVER() AS "totalCount",
    //       c."id"::text AS "id",
    //       c."content" AS "content",
    //       json_build_object(
    //         'userId', c."commentatorId"::text,
    //         'userLogin', u."login"
    //       ) AS "commentatorInfo",
    //       c."createdAt" AS "createdAt",
    //       json_build_object(
    //         'likesCount', COALESCE(lc.count, 0),
    //         'dislikesCount', COALESCE(dc.count, 0),
    //         'myStatus', COALESCE(cr."status", 'None')
    //       ) AS "likesInfo"
    //     FROM "Comments" c
    //            JOIN "Users" u ON u."id" = c."commentatorId"
    //            LEFT JOIN "LikesCount" lc ON lc."commentId" = c."id"
    //            LEFT JOIN "DislikesCount" dc ON dc."commentId" = c."id"
    //            LEFT JOIN "CommentsReactions" cr ON cr."commentId" = c."id" AND cr."userId" = $4
    //     WHERE c."deletedAt" IS NULL
    //       AND (c."postId" = $3)
    //     ORDER BY c."${sortBy}" ${sortDirection.toUpperCase()}
    //     OFFSET $1 LIMIT $2
    //   `,
    //   [offset, pageSize, dto.postId, dto.userId],
    // );
    //
    // const totalCount: number = rows.length > 0 ? +rows[0].totalCount : 0;

    return {} as PaginatedViewDto<CommentViewDto>;
  }
}
