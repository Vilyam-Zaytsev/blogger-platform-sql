import { Injectable } from '@nestjs/common';
import { PostViewDto } from '../../api/view-dto/post.view-dto';
import { UserContextDto } from '../../../../user-accounts/auth/domain/guards/dto/user-context.dto';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';
import {
  GetPostsQueryParams,
  PostsSortBy,
} from '../../api/input-dto/get-posts-query-params.input-dto';
import { PaginatedViewDto } from '../../../../../core/dto/paginated.view-dto';
import { RawPost, RawPostWithCount } from './types/raw-post.type';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ReactionStatus } from '../../../reactions/domain/entities/reaction.entity';
import { Post } from '../../domain/entities/post.entity';

@Injectable()
export class PostsQueryRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async getByIdOrNotFoundFail(id: number, user: UserContextDto | null): Promise<PostViewDto> {
    const likesCountQueryBuilder = this.dataSource
      .createQueryBuilder()
      .select(['rp."postId" AS "postId"', 'COUNT(*) AS "count"'])
      .from('reactions_posts', 'rp')
      .leftJoin('reactions', 'r', 'r."id" = rp."reactionId"')
      .where('r.status = :likeStatus', { likeStatus: ReactionStatus.Like })
      .groupBy('rp."postId"');

    const dislikesCountQueryBuilder = this.dataSource
      .createQueryBuilder()
      .select(['rp."postId" AS "postId"', 'COUNT(*) AS "count"'])
      .from('reactions_posts', 'rp')
      .leftJoin('reactions', 'r', 'r."id" = rp."reactionId"')
      .where('r.status = :dislikeStatus', { dislikeStatus: ReactionStatus.Dislike })
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
          .where('r.status = :newestLikesStatus', { newestLikesStatus: ReactionStatus.Like });
      }, 'r2')
      .leftJoin('users', 'u', 'u.id = r2."userId"')
      .where('r2.rn <= 3')
      //TODO: зачем groupBy
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
      .where('post.id = :id', { id });

    if (user?.id) {
      mainQueryBuilder
        .leftJoin('reactions_posts', 'user_rp', 'user_rp."postId" = post.id')
        .leftJoin(
          'reactions',
          'user_r',
          'user_r."id" = user_rp."reactionId" AND user_r."userId" = :currentUserId',
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
    const { sortBy, sortDirection, pageSize, pageNumber }: GetPostsQueryParams = query;
    const skip: number = query.calculateSkip();

    const likesCountQueryBuilder = this.dataSource
      .createQueryBuilder()
      .select(['rp."postId" AS "postId"', 'COUNT(*) AS "count"'])
      .from('reactions_posts', 'rp')
      .leftJoin('reactions', 'r', 'r."id" = rp."reactionId"')
      .where('r."status" = :likeStatus', { likeStatus: ReactionStatus.Like })
      .groupBy('rp."postId"');

    const dislikesCountQueryBuilder = this.dataSource
      .createQueryBuilder()
      .select(['rp."postId" AS "postId"', 'COUNT(*) AS "count"'])
      .from('reactions_posts', 'rp')
      .leftJoin('reactions', 'r', 'r."id" = rp."reactionId"')
      .where('r."status" = :dislikeStatus', { dislikeStatus: ReactionStatus.Dislike })
      .groupBy('rp."postId"');

    const newestLikesQueryBuilder = this.dataSource
      .createQueryBuilder()
      .select([
        'r2."postId" AS "postId"',
        `json_agg(
          json_build_object(
            'addedAt', r2."createdAt",
            'userId', r2."userId",
            'login', u."login"
          ) ORDER BY r2."createdAt" DESC
        ) AS likes`,
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
          .where('r."status" = :newestLikesStatus', { newestLikesStatus: ReactionStatus.Like });
      }, 'r2')
      .leftJoin('users', 'u', 'u."id" = r2."userId"')
      .where('r2.rn <= 3')
      .groupBy('r2."postId"');

    const mainQueryBuilder = this.dataSource
      .getRepository<Post>(Post)
      .createQueryBuilder('post')
      .addCommonTableExpression(likesCountQueryBuilder, 'likes_count')
      .addCommonTableExpression(dislikesCountQueryBuilder, 'dislikes_count')
      .addCommonTableExpression(newestLikesQueryBuilder, 'newest_likes')
      .leftJoin('post.blog', 'blog')
      .leftJoin('likes_count', 'lc', 'lc."postId" = post.id')
      .leftJoin('dislikes_count', 'dc', 'dc."postId" = post.id')
      .leftJoin('newest_likes', 'nl', 'nl."postId" = post.id')
      .leftJoin(
        (subQuery) =>
          subQuery
            .from('reactions_posts', 'user_rp')
            .leftJoin(
              'reactions',
              'user_r',
              'user_r."id" = user_rp."reactionId" AND user_r."userId" = :currentUserId',
            ),
        'rp2',
        'rp2."postId" = post.id',
        { currentUserId: user?.id ?? null },
      )
      //TODO: оптимизировать это условие
      .where(blogId ? 'post."blogId" = :blogId' : '1=1', { blogId: blogId ?? undefined });

    const orderByColumn: string =
      sortBy !== PostsSortBy.BlogName ? `post."${sortBy}"` : 'blog."name"';

    mainQueryBuilder
      .orderBy(orderByColumn, sortDirection.toUpperCase() as 'ASC' | 'DESC')
      .skip(skip)
      .take(pageSize);

    mainQueryBuilder
      .select([
        'COUNT(*) OVER() AS "totalCount"',
        'post.id AS "id"',
        'post.title AS "title"',
        'post.shortDescription AS "shortDescription"',
        'post.content AS "content"',
        'blog.id AS "blogId"',
        'blog.name AS "blogName"',
        'post.createdAt AS "createdAt"',
      ])
      .addSelect('COALESCE(lc."count", 0)', 'likesCount')
      .addSelect('COALESCE(dc."count", 0)', 'dislikesCount')
      .addSelect('COALESCE(nl."likes", \'[]\')', 'newestLikes')
      .addSelect(
        user?.id
          ? `COALESCE(user_r."status", '${ReactionStatus.None}')`
          : `'${ReactionStatus.None}'`,
        'myStatus',
      );

    const rawPosts: RawPostWithCount[] = await mainQueryBuilder.getRawMany<RawPostWithCount>();
    const totalCount: number = await mainQueryBuilder.getCount();
    const pagesCount: number = Math.ceil(totalCount / pageSize);

    return {
      pagesCount,
      page: pageNumber,
      pageSize,
      totalCount,
      items: rawPosts.map((post) => PostViewDto.mapRawPostToPostViewDto(post)),
    };
  }
}
