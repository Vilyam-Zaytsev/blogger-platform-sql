import { Injectable } from '@nestjs/common';
import { PostViewDto } from '../../api/view-dto/post.view-dto';
import { UserContextDto } from '../../../../user-accounts/auth/domain/guards/dto/user-context.dto';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';
import {
  GetPostsQueryParams,
  PostsSortBy,
  PostsSortBy_DB,
} from '../../api/input-dto/get-posts-query-params.input-dto';
import { PaginatedViewDto } from '../../../../../core/dto/paginated.view-dto';
import { RawPost } from './types/raw-post.type';
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
      .select('rp.post_id', 'postId')
      .addSelect('COUNT(*)', 'count')
      .from('reactions_posts', 'rp')
      .innerJoin('reactions', 'r', 'r.id = rp.reaction_id')
      .where('r.status = :like', { like: ReactionStatus.Like })
      .groupBy('rp.post_id');

    const dislikesCountQueryBuilder = this.dataSource
      .createQueryBuilder()
      .select('rp.post_id', 'postId')
      .addSelect('COUNT(*)', 'count')
      .from('reactions_posts', 'rp')
      .innerJoin('reactions', 'r', 'r.id = rp.reaction_id')
      .where('r.status = :dislike', { dislike: ReactionStatus.Dislike })
      .groupBy('rp.post_id');

    const newestLikesQueryBuilder = this.dataSource
      .createQueryBuilder()
      .select('r2."postId"', 'postId')
      .addSelect(
        `json_agg(
        json_build_object(
          'addedAt', r2."createdAt",
          'userId', r2."userId",
          'login', u.login
        ) ORDER BY r2."createdAt" DESC
      )`,
        'likes',
      )
      .from(
        (qb) =>
          qb
            .select('rp.post_id', 'postId')
            .addSelect('r.created_at', 'createdAt')
            .addSelect('r.user_id', 'userId')
            .addSelect(
              'ROW_NUMBER() OVER (PARTITION BY rp.post_id ORDER BY r.created_at DESC)',
              'rn',
            )
            .from('reactions_posts', 'rp')
            .innerJoin('reactions', 'r', 'r.id = rp.reaction_id')
            .where('r.status = :like', { like: ReactionStatus.Like }),
        'r2',
      )
      .innerJoin('users', 'u', 'u.id = r2."userId"')
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
      .where('post.id = :id', { id });

    mainQueryBuilder
      .select([
        'post.id AS id',
        'post.title AS title',
        'post.shortDescription AS "shortDescription"',
        'post.content AS content',
        'post.createdAt AS "createdAt"',
        'blog.id AS "blogId"',
        'blog.name AS "blogName"',
      ])
      .addSelect('COALESCE(lc.count, 0)', 'likesCount')
      .addSelect('COALESCE(dc.count, 0)', 'dislikesCount')
      .addSelect("COALESCE(nl.likes, '[]')", 'newestLikes');

    if (user?.id) {
      mainQueryBuilder.addSelect(
        (subQb) =>
          subQb
            .select('r.status')
            .from('reactions_posts', 'rp')
            .innerJoin(
              'reactions',
              'r',
              `
          r.id = rp.reaction_id
         AND r.userId = :uid
         `,
              { uid: user.id },
            )
            .where('rp.post_id = post.id')
            .limit(1),
        'myStatus',
      );
    } else {
      mainQueryBuilder.addSelect(`'${ReactionStatus.None}'`, 'myStatus');
    }

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
      .select('rp.post_id', 'postId')
      .addSelect('COUNT(*)', 'count')
      .from('reactions_posts', 'rp')
      .innerJoin('reactions', 'r', 'r.id = rp.reaction_id')
      .where('r.status = :like', { like: ReactionStatus.Like })
      .groupBy('rp.post_id');

    const dislikesCountQueryBuilder = this.dataSource
      .createQueryBuilder()
      .select('rp.post_id', 'postId')
      .addSelect('COUNT(*)', 'count')
      .from('reactions_posts', 'rp')
      .innerJoin('reactions', 'r', 'r.id = rp.reaction_id')
      .where('r.status = :dislike', { dislike: ReactionStatus.Dislike })
      .groupBy('rp.post_id');

    const newestLikesQueryBuilder = this.dataSource
      .createQueryBuilder()
      .select('r2."postId"', 'postId')
      .addSelect(
        `json_agg(
         json_build_object(
           'addedAt', r2."createdAt",
           'userId', r2."userId",
           'login', u.login
         ) ORDER BY r2."createdAt" DESC
       )`,
        'likes',
      )
      .from(
        (qb) =>
          qb
            .select('rp.post_id', 'postId')
            .addSelect('r.created_at', 'createdAt')
            .addSelect('r.user_id', 'userId')
            .addSelect(
              'ROW_NUMBER() OVER (PARTITION BY rp.post_id ORDER BY r.created_at DESC)',
              'rn',
            )
            .from('reactions_posts', 'rp')
            .innerJoin('reactions', 'r', 'r.id = rp.reaction_id')
            .where('r.status = :like', { like: ReactionStatus.Like }),
        'r2',
      )
      .innerJoin('users', 'u', 'u.id = r2."userId"')
      .where('r2.rn <= 3')
      .groupBy('r2."postId"');

    const mainQueryBuilder = this.dataSource
      .getRepository(Post)
      .createQueryBuilder('post')
      .addCommonTableExpression(likesCountQueryBuilder, 'likes_count')
      .addCommonTableExpression(dislikesCountQueryBuilder, 'dislikes_count')
      .addCommonTableExpression(newestLikesQueryBuilder, 'newest_likes')
      .leftJoin('post.blog', 'blog')
      .leftJoin('likes_count', 'lc', 'lc."postId" = post.id')
      .leftJoin('dislikes_count', 'dc', 'dc."postId" = post.id')
      .leftJoin('newest_likes', 'nl', 'nl."postId" = post.id')
      .where(blogId ? 'post.blogId = :blogId' : '1=1', { blogId });

    mainQueryBuilder
      .select([
        'post.id AS id',
        'post.title AS title',
        'post.shortDescription AS "shortDescription"',
        'post.content AS content',
        'post.created_at AS "createdAt"',
        'blog.id AS "blogId"',
        'blog.name AS "blogName"',
      ])
      .addSelect('COALESCE(lc.count, 0)', 'likesCount')
      .addSelect('COALESCE(dc.count, 0)', 'dislikesCount')
      .addSelect("COALESCE(nl.likes, '[]')", 'newestLikes');

    if (user?.id) {
      mainQueryBuilder.addSelect(
        (subQb) =>
          subQb
            .select('r.status')
            .from('reactions_posts', 'rp')
            .innerJoin(
              'reactions',
              'r',
              `
          r.id = rp.reaction_id
         AND r.userId = :uid
         `,
              { uid: user.id },
            )
            .where('rp.post_id = post.id')
            .limit(1),
        'myStatus',
      );
    } else {
      mainQueryBuilder.addSelect(`'${ReactionStatus.None}'`, 'myStatus');
    }

    //TODO: временное решение
    const orderByColumn: string =
      sortBy !== PostsSortBy.BlogName ? `post.${PostsSortBy_DB[sortBy]}` : 'blog.name';

    mainQueryBuilder
      .orderBy(orderByColumn, sortDirection.toUpperCase() as 'ASC' | 'DESC')
      .offset(skip)
      .limit(pageSize);

    const rawPosts: RawPost[] = await mainQueryBuilder.getRawMany<RawPost>();
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
