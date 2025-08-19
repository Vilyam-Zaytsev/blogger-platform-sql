import { Inject, Injectable } from '@nestjs/common';
import { PostViewDto } from '../../api/view-dto/post-view.dto';
import { PG_POOL } from '../../../../database/constants/database.constants';
import { Pool, QueryResult } from 'pg';
import { UserContextDto } from '../../../../user-accounts/auth/domain/guards/dto/user-context.dto';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';
import {
  GetPostsQueryParams,
  PostsSortBy,
} from '../../api/input-dto/get-posts-query-params.input-dto';
import { PaginatedViewDto } from '../../../../../core/dto/paginated.view-dto';
import { ValidationException } from '../../../../../core/exceptions/validation-exception';
import { SortDirection } from '../../../../../core/dto/base.query-params.input-dto';
import { PostRawRow } from '../../types/post-raw-row.type';

@Injectable()
export class PostsQueryRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async getByIdOrNotFoundFail(id: number, user: UserContextDto | null): Promise<PostViewDto> {
    const { rows }: QueryResult<PostViewDto> = await this.pool.query(
      `
        WITH "LikesCount" AS (SELECT "postId", COUNT(*) AS "count"
                              FROM "PostsReactions"
                              WHERE "status" = 'Like'
                              GROUP BY "postId"),
             "DislikesCount" AS (SELECT "postId", COUNT(*) AS "count"
                                 FROM "PostsReactions"
                                 WHERE "status" = 'Dislike'
                                 GROUP BY "postId"),
             "NewestLikes" AS (SELECT pr2."postId",
                                      json_agg(
                                        json_build_object(
                                          'addedAt', pr2."createdAt",
                                          'userId', pr2."userId"::text,
                                          'login', u."login"
                                        ) ORDER BY pr2."createdAt" DESC
                                      ) AS "likes"
                               FROM (SELECT pr.*,
                                            ROW_NUMBER() OVER (PARTITION BY pr."postId" ORDER BY pr."createdAt" DESC) AS rn
                                     FROM "PostsReactions" pr
                                     WHERE pr."status" = 'Like') pr2
                                      JOIN "Users" u ON u."id" = pr2."userId"
                               WHERE pr2.rn <= 3
                               GROUP BY pr2."postId")
        SELECT p."id"::text, p."title",
               p."shortDescription",
               p."content",
               b."id"::text AS "blogId", b."name" AS "blogName",
               p."createdAt",
               json_build_object(
                 'likesCount', COALESCE(lc.count, 0),
                 'dislikesCount', COALESCE(dc.count, 0),
                 'myStatus', COALESCE(pr."status", 'None'),
                 'newestLikes', COALESCE(nl.likes, '[]')
               ) AS "extendedLikesInfo"
        FROM "Posts" p
               JOIN "Blogs" b ON b."id" = p."blogId"
               LEFT JOIN "LikesCount" lc ON lc."postId" = p."id"
               LEFT JOIN "DislikesCount" dc ON dc."postId" = p."id"
               LEFT JOIN "PostsReactions" pr ON pr."postId" = p."id" AND pr."userId" = $2
               LEFT JOIN "NewestLikes" nl ON nl."postId" = p."id"
        WHERE p."id" = $1
          AND p."deletedAt" IS NULL;
      `,
      [id, user?.id ?? null],
    );

    if (rows.length === 0) {
      throw new DomainException({
        code: DomainExceptionCode.NotFound,
        message: `The post with ID (${id}) does not exist`,
      });
    }

    return rows[0];
  }

  async getAll(
    query: GetPostsQueryParams,
    user: UserContextDto | null,
    blogId?: number,
  ): Promise<PaginatedViewDto<PostViewDto>> {
    const { sortBy, sortDirection, pageSize, pageNumber }: GetPostsQueryParams = query;

    if (!Object.values(PostsSortBy).includes(sortBy)) {
      throw new ValidationException([
        {
          message: `Invalid sortBy: ${sortBy}`,
          field: 'sortBy',
        },
      ]);
    }

    if (!Object.values(SortDirection).includes(sortDirection)) {
      throw new ValidationException([
        {
          message: `Invalid sortDirection: ${sortDirection}`,
          field: 'sortDirection',
        },
      ]);
    }

    const orderByColumn: string = sortBy !== PostsSortBy.BlogName ? `p."${sortBy}"` : 'b."name"';

    const offset: number = query.calculateSkip();

    const { rows }: QueryResult<PostRawRow> = await this.pool.query(
      `
        WITH "LikesCount" AS (SELECT "postId", COUNT(*) AS "count"
                              FROM "PostsReactions"
                              WHERE "status" = 'Like'
                              GROUP BY "postId"),

             "DislikesCount" AS (SELECT "postId", COUNT(*) AS "count"
                                 FROM "PostsReactions"
                                 WHERE "status" = 'Dislike'
                                 GROUP BY "postId"),

             "NewestLikes" AS (SELECT pr2."postId",
                                      json_agg(
                                        json_build_object(
                                          'addedAt', pr2."createdAt",
                                          'userId', pr2."userId"::text,
                                          'login', u."login"
                                        ) ORDER BY pr2."createdAt" DESC
                                      ) AS "likes"
                               FROM (SELECT pr.*,
                                            ROW_NUMBER() OVER (PARTITION BY pr."postId" ORDER BY pr."createdAt" DESC) AS rn
                                     FROM "PostsReactions" pr
                                     WHERE pr."status" = 'Like') pr2
                                      JOIN "Users" u ON u."id" = pr2."userId"
                               WHERE pr2.rn <= 3
                               GROUP BY pr2."postId")

        SELECT COUNT(*) OVER() AS "totalCount", p."id"::text, p."title",
               p."shortDescription",
               p."content",
               b."id"::text AS "blogId", b."name" AS "blogName",
               p."createdAt",
               json_build_object(
                 'likesCount', COALESCE(lc."count", 0),
                 'dislikesCount', COALESCE(dc."count", 0),
                 'myStatus', COALESCE(pr."status", 'None'),
                 'newestLikes', COALESCE(nl."likes", '[]')
               ) AS     "extendedLikesInfo"
        FROM "Posts" p
               JOIN "Blogs" b ON b."id" = p."blogId"
               LEFT JOIN "LikesCount" lc ON lc."postId" = p."id"
               LEFT JOIN "DislikesCount" dc ON dc."postId" = p."id"
               LEFT JOIN "PostsReactions" pr ON pr."postId" = p."id" AND pr."userId" = $3
               LEFT JOIN "NewestLikes" nl ON nl."postId" = p."id"
        WHERE p."deletedAt" IS NULL
          AND ($4::int IS NULL OR p."blogId" = $4)
        ORDER BY ${orderByColumn} ${sortDirection.toUpperCase()}
        OFFSET $1 LIMIT $2
      `,
      [offset, pageSize, user?.id ?? null, blogId ?? null],
    );

    const totalCount: number = rows.length > 0 ? +rows[0].totalCount : 0;
    const pagesCount: number = Math.ceil(totalCount / pageSize);

    return {
      pagesCount,
      page: pageNumber,
      pageSize,
      totalCount,
      items: rows.map(
        (row): PostViewDto => ({
          id: row.id,
          title: row.title,
          shortDescription: row.shortDescription,
          content: row.content,
          blogId: row.blogId,
          blogName: row.blogName,
          createdAt: row.createdAt,
          extendedLikesInfo: row.extendedLikesInfo,
        }),
      ),
    };
  }
}
