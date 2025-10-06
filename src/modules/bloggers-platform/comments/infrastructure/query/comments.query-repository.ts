import { Injectable } from '@nestjs/common';
import { CommentViewDto } from '../../api/view-dto/comment-view.dto';
import { CommentsQueryDto } from '../../dto/comments-query.dto';
import { PaginatedViewDto } from '../../../../../core/dto/paginated.view-dto';
import { UserContextDto } from '../../../../user-accounts/auth/domain/guards/dto/user-context.dto';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ReactionStatus } from '../../../reactions/domain/entities/reaction.entity';
import { Comment } from '../../domain/entities/comment.entity';
import { RawComment } from './types/raw-comment.type';

@Injectable()
export class CommentsQueryRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async getByIdOrNotFoundFail(id: number, user: UserContextDto | null): Promise<CommentViewDto> {
    const likesCountQueryBuilder = this.dataSource
      .createQueryBuilder()
      .select('rc."commentId"', 'commentId')
      .addSelect('COUNT(*)', 'count')
      .from('reactions_comments', 'rc')
      .innerJoin('reactions', 'r', 'r.id = rc."reactionId"')
      .where('r.status = :like', { like: ReactionStatus.Like })
      .groupBy('rc."commentId"');

    const dislikesCountQueryBuilder = this.dataSource
      .createQueryBuilder()
      .select('rc."commentId"', 'commentId')
      .addSelect('COUNT(*)', 'count')
      .from('reactions_comments', 'rc')
      .innerJoin('reactions', 'r', 'r.id = rc."commentId"')
      .where('r.status = :dislike', { dislike: ReactionStatus.Dislike })
      .groupBy('rc."commentId"');

    const mainQueryBuilder = this.dataSource
      .getRepository<Comment>(Comment)
      .createQueryBuilder('comment')
      .addCommonTableExpression(likesCountQueryBuilder, 'likes_count')
      .addCommonTableExpression(dislikesCountQueryBuilder, 'dislikes_count')
      .leftJoin('comment.user', 'user')
      .leftJoin('likes_count', 'lc', 'lc."commentId" = comment.id')
      .leftJoin('dislikes_count', 'dc', 'dc."commentId" = comment.id')
      .where('comment.id = :id', { id });

    mainQueryBuilder
      .select([
        'comment.id AS id',
        'comment.content AS content',
        'comment.createdAt AS "createdAt"',
        'user.id AS "userId"',
        'user.login AS "userLogin"',
      ])
      .addSelect('COALESCE(lc.count, 0)', 'likesCount')
      .addSelect('COALESCE(dc.count, 0)', 'dislikesCount');

    if (user?.id) {
      mainQueryBuilder.addSelect(
        (subQb) =>
          subQb
            .select('r.status')
            .from('reactions_comments', 'rc')
            .innerJoin(
              'reactions',
              'r',
              `
            r.id = rc."reactionId" 
            AND r.userId = :uid
            `,
              { uid: user.id },
            )
            .where('rc."commentId" = comment.id')
            .limit(1),
        'myStatus',
      );
    } else {
      mainQueryBuilder.addSelect(`'${ReactionStatus.None}'`, 'myStatus');
    }

    const rawComment: RawComment | null = (await mainQueryBuilder.getRawOne()) ?? null;

    console.log(rawComment);

    return {} as CommentViewDto;
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
