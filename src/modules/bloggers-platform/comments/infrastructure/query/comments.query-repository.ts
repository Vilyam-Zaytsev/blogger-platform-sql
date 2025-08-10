import { Inject, Injectable } from '@nestjs/common';
import { CommentViewDto } from '../../api/view-dto/comment-view.dto';
import { PG_POOL } from '../../../../database/constants/database.constants';
import { Pool, QueryResult } from 'pg';

@Injectable()
export class CommentsQueryRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async getByIdOrNotFoundFail(id: number, user?: number | null): Promise<CommentViewDto> {
    const { rows }: QueryResult<CommentViewDto> = await this.pool.query(
      `
        WITH "LikesCount" AS (select "commentId", COUNT(*) AS "count"
                              from "CommentsReactions"
                              WHERE "status" = 'Like'
                              GROUP BY "commentId"),

             "DislikesCount" AS (SELECT "commentId", COUNT(*) AS "count"
                                 FROM "CommentsReactions"
                                 WHERE "status" = 'Dislike'
                                 GROUP BY "commentId")

        SELECT c."id"::text AS "id", c."content" AS "content",
               json_build_object(
                 'userId', c."commentatorId"::text,
                 'userLogin', u."login"
               ) AS "commentatorInfo",
               c."createdAt"::text AS "createdAt", json_build_object(
          'likesCount', COALESCE(lc.count, 0),
          'dislikesCount', COALESCE(dc.count, 0),
          'myStatus', COALESCE(cr."status", 'None')
                                                   ) AS "likesInfo"
        FROM "Comments" c
               JOIN "Users" u ON u."id" = c."commentatorId"
               LEFT JOIN "LikesCount" lc ON lc."commentId" = c."id"
               LEFT JOIN "DislikesCount" dc ON dc."commentId" = c."id"
               LEFT JOIN "CommentsReactions" cr ON cr."commentId" = c."id"
          AND cr."userId" = $2
        WHERE c."id" = $1
          AND c."deletedAt" IS NULL
      `,
      [id, user],
    );

    return rows[0];
  }

  // async getAll(
  //   query: GetCommentsQueryParams,
  //   user: UserContextDto | null,
  //   postId: string,
  // ): Promise<PaginatedViewDto<CommentViewDto>> {
  //   const filter: FilterQuery<Comment> = {
  //     postId,
  //     deletedAt: null,
  //   };
  //
  //   const comments: CommentDocument[] = await this.CommentModel.find(filter)
  //     .sort({ [query.sortBy]: query.sortDirection })
  //     .skip(query.calculateSkip())
  //     .limit(query.pageSize);
  //
  //   const commentsIds: string[] = comments.map(
  //     (comment: CommentDocument): string => comment._id.toString(),
  //   );
  //
  //   const allReactionsForComments: ReactionDocument[] =
  //     await this.reactionsRepository.getByParentIds(commentsIds);
  //
  //   const mapUserReactionsForComments: Map<string, ReactionStatus> = new Map();
  //
  //   if (user) {
  //     allReactionsForComments.reduce<Map<string, ReactionStatus>>(
  //       (
  //         acc: Map<string, ReactionStatus>,
  //         reaction: ReactionDocument,
  //       ): Map<string, ReactionStatus> => {
  //         if (reaction.userId === user.id) {
  //           acc.set(reaction.parentId, reaction.status);
  //         }
  //
  //         return acc;
  //       },
  //       mapUserReactionsForComments,
  //     );
  //   }
  //
  //   const items: CommentViewDto[] = comments.map(
  //     (comment: CommentDocument): CommentViewDto => {
  //       let myStatus: ReactionStatus | undefined;
  //
  //       if (user) {
  //         const id: string = comment._id.toString();
  //
  //         myStatus = mapUserReactionsForComments.get(id);
  //       }
  //
  //       return CommentViewDto.mapToView(
  //         comment,
  //         myStatus ? myStatus : ReactionStatus.None,
  //       );
  //     },
  //   );
  //
  //   const totalCount: number = await this.CommentModel.countDocuments(filter);
  //
  //   return PaginatedViewDto.mapToView<CommentViewDto>({
  //     items,
  //     totalCount,
  //     page: query.pageNumber,
  //     size: query.pageSize,
  //   });
  // }
}
