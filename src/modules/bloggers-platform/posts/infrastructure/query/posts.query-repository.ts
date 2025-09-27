import { Injectable } from '@nestjs/common';
import { PostViewDto } from '../../api/view-dto/post.view-dto';
import { QueryResult } from 'pg';
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
import { RawPost } from './types/raw-post.type';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ReactionPost } from '../../../reactions/domain/entities/reaction-post.entity';
import { ReactionStatus } from '../../../reactions/domain/entities/reaction.entity';
import { Post } from '../../domain/entities/post.entity';

@Injectable()
export class PostsQueryRepository {
  pool: any = {};

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async getByIdOrNotFoundFail(id: number, user: UserContextDto | null): Promise<PostViewDto> {
    const likesCountQueryBuilder = this.dataSource
      .createQueryBuilder()
      .select(['rp."postId" AS "postId"', 'COUNT(*) AS "count"'])
      .from('reactions_posts', 'rp')
      .leftJoin('reactions', 'r', 'r."id" = rp."reactionId"')
      .where('r.status = :likeStatus', { likeStatus: ReactionStatus.Like })
      .andWhere('r."deletedAt" IS NULL')
      .groupBy('rp."postId"');

    const dislikesCountQueryBuilder = this.dataSource
      .createQueryBuilder()
      .select(['rp."postId" AS "postId"', 'COUNT(*) AS "count"'])
      .from('reactions_posts', 'rp')
      .leftJoin('reactions', 'r', 'r."id" = rp."reactionId"')
      .where('r.status = :dislikeStatus', { dislikeStatus: ReactionStatus.Dislike })
      .andWhere('r."deletedAt" IS NULL')
      .groupBy('rp."postId"');

    const newestLikesQueryBuilder = this.dataSource
      .createQueryBuilder()
      .select([
        'r2."postId" AS "postId"',
        `json_agg(
        json_build_object(
          'addedAt', r2."createdAt",
          'userId', r2."userId",
          'login', u.login
        ) ORDER BY r2."createdAt" DESC
      ) AS "likes"`,
      ])
      .from((subQuery) => {
        return subQuery
          .select([
            'rp."postId" AS "postId"',
            'r."createdAt" AS "createdAt"',
            'r."userId" AS "userId"',
            'ROW_NUMBER() OVER (PARTITION BY rp."postId" ORDER BY r."createdAt" DESC) AS rn',
          ])
          .from('reactions_posts', 'rp')
          .leftJoin('reactions', 'r', 'r."id" = rp."reactionId"')
          .where('r.status = :newestLikesStatus', { newestLikesStatus: ReactionStatus.Like })
          .andWhere('r."deletedAt" IS NULL');
      }, 'r2')
      .leftJoin('users', 'u', 'u.id = r2."userId"')
      .where('r2.rn <= 3')
      .groupBy('r2."postId"');

    const mainQueryBuilder = this.dataSource
      .getRepository<Post>(Post)
      .createQueryBuilder('post')
      .addCommonTableExpression(likesCountQueryBuilder, 'likes_count')
      .addCommonTableExpression(dislikesCountQueryBuilder, 'dislikes_count')
      .addCommonTableExpression(newestLikesQueryBuilder, 'newest_likes')
      .leftJoinAndSelect('post.blog', 'blog')
      .leftJoin('likes_count', 'lc', 'lc."postId" = post.id')
      .leftJoin('dislikes_count', 'dc', 'dc."postId" = post.id')
      .leftJoin('newest_likes', 'nl', 'nl."postId" = post.id')
      .where('post.id = :id', { id })
      .andWhere('post."deletedAt" IS NULL');

    if (user?.id) {
      mainQueryBuilder
        .leftJoin('reactions_posts', 'user_rp', 'user_rp."postId" = post.id')
        .leftJoin(
          'reactions',
          'user_r',
          'user_r."id" = user_rp."reactionId" AND user_r."userId" = :currentUserId AND user_r."deletedAt" IS NULL',
          { currentUserId: user.id },
        );
    }

    mainQueryBuilder
      .select([
        'post.id AS "id"',
        'post.title AS "title"',
        'post."shortDescription" AS "shortDescription"',
        'post.content AS "content"',
        'post."createdAt" AS "createdAt"',
        'blog.id AS "blogId"',
        'blog.name AS "blogName"',
      ])
      .addSelect('COALESCE(lc."count", 0)', 'likesCount')
      .addSelect('COALESCE(dc."count", 0)', 'dislikesCount')
      .addSelect('COALESCE(nl."likes", \'[]\')', 'newestLikes')
      .addSelect(
        user?.id
          ? `COALESCE(user_r."status", '${ReactionStatus.None}' )`
          : `'${ReactionStatus.None}'`,
        'myStatus',
      );
    //TODO: какой вариант подстановки статуса предпочтительнее??
    // .addSelect(user?.id ? "COALESCE(user_r.status, 'None')" : "'None'", 'myStatus');

    const rawPost: RawPost | null = (await mainQueryBuilder.getRawOne()) ?? null;

    if (!rawPost) {
      throw new DomainException({
        code: DomainExceptionCode.NotFound,
        message: `The post with ID (${id}) does not exist`,
      });
    }

    return PostViewDto.mapRawPostToPostViewDto(rawPost);
  }

  async getAll(
    query: GetPostsQueryParams,
    user: UserContextDto | null,
    blogId?: number,
  ): Promise<PaginatedViewDto<PostViewDto>> {
    // const { sortBy, sortDirection, pageSize, pageNumber }: GetPostsQueryParams = query;
    //
    // if (!Object.values(PostsSortBy).includes(sortBy)) {
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
    // const orderByColumn: string = sortBy !== PostsSortBy.BlogName ? `p."${sortBy}"` : 'b."name"';
    //
    // const offset: number = query.calculateSkip();
    //
    // const { rows }: QueryResult<RawPost> = await this.pool.query(
    //   `
    //       WITH "LikesCount" AS (SELECT "postId", COUNT(*) AS "count"
    //                             FROM "PostsReactions"
    //                             WHERE "status" = 'Like'
    //                             GROUP BY "postId"),
    //
    //            "DislikesCount" AS (SELECT "postId", COUNT(*) AS "count"
    //                                FROM "PostsReactions"
    //                                WHERE "status" = 'Dislike'
    //                                GROUP BY "postId"),
    //
    //            "NewestLikes" AS (SELECT pr2."postId",
    //                                     json_agg(
    //                                             json_build_object(
    //                                                     'addedAt', pr2."createdAt",
    //                                                     'userId', pr2."userId"::text,
    //                                                     'login', u."login"
    //                                             ) ORDER BY pr2."createdAt" DESC
    //                                     ) AS "likes"
    //                              FROM (SELECT pr.*,
    //                                           ROW_NUMBER() OVER (PARTITION BY pr."postId" ORDER BY pr."createdAt" DESC) AS rn
    //                                    FROM "PostsReactions" pr
    //                                    WHERE pr."status" = 'Like') pr2
    //                                       JOIN "Users" u ON u."id" = pr2."userId"
    //                              WHERE pr2.rn <= 3
    //                              GROUP BY pr2."postId")
    //
    //       SELECT COUNT(*) OVER() AS "totalCount", p."id"::text, p."title",
    //              p."shortDescription",
    //              p."content",
    //              b."id"::text AS "blogId", b."name" AS "blogName",
    //              p."createdAt",
    //              json_build_object(
    //                      'likesCount', COALESCE(lc."count", 0),
    //                      'dislikesCount', COALESCE(dc."count", 0),
    //                      'myStatus', COALESCE(pr."status", 'None'),
    //                      'newestLikes', COALESCE(nl."likes", '[]')
    //              ) AS     "extendedLikesInfo"
    //       FROM "Posts" p
    //                JOIN "Blogs" b ON b."id" = p."blogId"
    //                LEFT JOIN "LikesCount" lc ON lc."postId" = p."id"
    //                LEFT JOIN "DislikesCount" dc ON dc."postId" = p."id"
    //                LEFT JOIN "PostsReactions" pr ON pr."postId" = p."id" AND pr."userId" = $3
    //                LEFT JOIN "NewestLikes" nl ON nl."postId" = p."id"
    //       WHERE p."deletedAt" IS NULL
    //         AND ($4::int IS NULL OR p."blogId" = $4)
    //       ORDER BY ${orderByColumn} ${sortDirection.toUpperCase()}
    //       OFFSET $1 LIMIT $2
    //   `,
    //   [offset, pageSize, user?.id ?? null, blogId ?? null],
    // );
    //
    // const totalCount: number = rows.length > 0 ? +rows[0].totalCount : 0;
    // const pagesCount: number = Math.ceil(totalCount / pageSize);
    //
    // return {
    //   pagesCount,
    //   page: pageNumber,
    //   pageSize,
    //   totalCount,
    //   items: rows.map(
    //     (row): PostViewDto => ({
    //       id: row.id,
    //       title: row.title,
    //       shortDescription: row.shortDescription,
    //       content: row.content,
    //       blogId: row.blogId,
    //       blogName: row.blogName,
    //       createdAt: row.createdAt,
    //       extendedLikesInfo: row.extendedLikesInfo,
    //     }),
    //   ),
    // };

    return {} as PaginatedViewDto<PostViewDto>;
  }
}
