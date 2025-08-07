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

@Injectable()
export class PostsQueryRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async getByIdOrNotFoundFail(
    id: number,
    user: UserContextDto | null,
  ): Promise<PostViewDto> {
    const { rows: posts }: QueryResult<PostViewDto> = await this.pool.query(
      `
        WITH "LikesCount" AS (SELECT "postId", COUNT(*) AS "count"
                              FROM "PostsReactions"
                              WHERE "status" = 'Like'
                              GROUP BY "postId"),

             "DislikesCount" AS (SELECT "postId", COUNT(*) AS "count"
                                 FROM "PostsReactions"
                                 WHERE "status" = 'Dislike'
                                 GROUP BY "postId"),

             "NewestLikes" AS (SELECT "postId",
                                      json_agg(
                                        json_build_object(
                                          'addedAt', pr."createdAt"::text,
                                          'userId', pr."userId"::text,
                                          'login', u."login"
                                        ) ORDER BY pr."createdAt" DESC
                                      ) FILTER (WHERE pr."status" = 'Like') AS "likes"
                               FROM "PostsReactions" pr
                                      JOIN "Users" u ON u."id" = pr."userId"
                               GROUP BY "postId")

        SELECT p."id"::text, p."title",
               p."shortDescription",
               p."content",
               b."id"::text AS "blogId", b."name" AS "blogName",
               p."createdAt"::text, json_build_object(
          'likesCount', COALESCE(lc.count, 0),
          'dislikesCount', COALESCE(dc.count, 0),
          'myStatus', COALESCE(pr."status", 'None'),
          'newestLikes', COALESCE(nl.likes, '[]')
                                    ) AS "extendedLikesInfo"
        FROM "Posts" p
               JOIN "Blogs" b ON b."id" = p."blogId"
               LEFT JOIN "LikesCount" lc ON lc."postId" = p."id"
               LEFT JOIN "DislikesCount" dc ON dc."postId" = p."id"
               LEFT JOIN "PostsReactions" pr ON pr."postId" = p."id"
          AND pr."userId" = $2
               LEFT JOIN "NewestLikes" nl ON nl."postId" = p."id"
        WHERE p."id" = $1
          AND p."deletedAt" IS NULL;
      `,
      [id, user],
    );

    if (posts.length === 0) {
      throw new DomainException({
        code: DomainExceptionCode.NotFound,
        message: `The post with ID (${id}) does not exist`,
      });
    }

    return posts[0];
  }

  async getAll(
    query: GetPostsQueryParams,
    user: UserContextDto | null,
    blogId?: number,
  ): Promise<PaginatedViewDto<PostViewDto>> {
    const { sortBy, sortDirection, pageSize, pageNumber }: GetPostsQueryParams =
      query;

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

    const offset: number = query.calculateSkip();

    const { rows }: QueryResult = await this.pool.query(
      `
        WITH "LikesCount" AS (SELECT "postId", COUNT(*) AS "count"
                              FROM "PostsReactions"
                              WHERE "status" = 'Like'
                              GROUP BY "postId"),

             "DislikesCount" AS (SELECT "postId", COUNT(*) AS "count"
                                 FROM "PostsReactions"
                                 WHERE "status" = 'Dislike'
                                 GROUP BY "postId"),

             "NewestLikes" AS (SELECT "postId",
                                      json_agg(
                                        json_build_object(
                                          'addedAt', pr."createdAt"::text,
                                          'userId', pr."userId"::text,
                                          'login', u."login"
                                        ) ORDER BY pr."createdAt" DESC
                                      ) AS "likes"
                               FROM "PostsReactions" pr
                                      JOIN "Users" u ON u."id" = pr."userId"
                               GROUP BY "postId")

        SELECT COUNT(*) OVER() AS "totalCount", p."id"::text, p."title",
               p."shortDescription",
               p."content",
               b."id"::text AS "blogId", b."name" AS "blogName",
               p."createdAt"::text, json_build_object(
          'likesCount', COALESCE(lc."count", 0),
          'dislikesCount', COALESCE(dc."count", 0),
          'myStatus', COALESCE(pr."status", 'None'),
          'newestLikes', COALESCE(nl."likes", '[]')
                                    ) AS "extendedLikesInfo"
        FROM "Posts" p
               JOIN "Blogs" b ON b."id" = p."blogId"
               LEFT JOIN "LikesCount" lc ON lc."postId" = p."id"
               LEFT JOIN "DislikesCount" dc ON dc."postId" = p."id"
               LEFT JOIN "PostsReactions" pr ON pr."postId" = p."id" AND pr."userId" = $3
               LEFT JOIN "NewestLikes" nl ON nl."postId" = p."id"
        WHERE p."deletedAt" IS NULL
        ORDER BY p."${sortBy}" ${sortDirection.toUpperCase()}
        OFFSET $1 LIMIT $2
      `,
      [offset, pageSize, user],
    );

    console.log(rows);

    return {} as PaginatedViewDto<PostViewDto>;
  }
}
