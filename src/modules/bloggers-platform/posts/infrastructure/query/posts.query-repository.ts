import { Inject, Injectable } from '@nestjs/common';
import { PostViewDto } from '../../api/view-dto/post-view.dto';
import { PG_POOL } from '../../../../database/constants/database.constants';
import { Pool, QueryResult } from 'pg';
import { UserContextDto } from '../../../../user-accounts/auth/domain/guards/dto/user-context.dto';
import { PostDbType } from '../../types/post-db.type';
import { ReactionsRepository } from '../../../reactions/infrastructure/reactions-repository';
import { ReactionStatus } from '../../../reactions/types/reaction-db.type';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';

@Injectable()
export class PostsQueryRepository {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly reactionsRepository: ReactionsRepository,
  ) {}

  async getByIdOrNotFoundFail(
    id: number,
    user: UserContextDto | null,
  ): Promise<PostViewDto> {
    const { rows: posts }: QueryResult<PostDbType> = await this.pool.query(
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
                                          'addedAt', pr."createdAt",
                                          'userId', pr."userId",
                                          'login', u."login"
                                        ) ORDER BY pr."createdAt" DESC
                                      ) FILTER (WHERE pr."status" = 'Like') AS "likes"
                               FROM "PostsReactions" pr
                                      JOIN "Users" u ON u."id" = pr."userId"
                               GROUP BY "postId")

        SELECT p."id",
               p."title",
               p."shortDescription",
               p."content",
               b."id" AS "blogId",
               b."name" AS "blogName",
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

    console.log(posts);
    return {} as PostViewDto;
  }

  // let userReactionStatus: ReactionStatus = ReactionStatus.None;
  //
  // if (user) {
  //   const reaction: ReactionDocument | null =
  //     await this.reactionsRepository.getByUserIdAndParentId(
  //       user.id,
  //       post._id.toString(),
  //     );
  //
  //   userReactionStatus = reaction ? reaction.status : ReactionStatus.None;
  // }
  //
  // return PostViewDto.mapToView(post, userReactionStatus);
  // async getAll(
  //   query: GetPostsQueryParams,
  //   user: UserContextDto | null,
  //   blogId?: string,
  // ): Promise<PaginatedViewDto<PostViewDto>> {
  //   const filter: FilterQuery<Post> = {
  //     deletedAt: null,
  //   };
  //
  //   if (blogId) {
  //     filter['blogId'] = blogId;
  //   }
  //
  //   const posts: PostDocument[] = await this.PostModel.find(filter)
  //     .sort({ [query.sortBy]: query.sortDirection })
  //     .skip(query.calculateSkip())
  //     .limit(query.pageSize);
  //
  //   const postsIds: string[] = posts.map((post) => post._id.toString());
  //
  //   const allReactionsForPosts: ReactionDocument[] =
  //     await this.reactionsRepository.getByParentIds(postsIds);
  //
  //   const mapUserReactionsForPosts: Map<string, ReactionStatus> = new Map();
  //
  //   if (user) {
  //     allReactionsForPosts.reduce<Map<string, ReactionStatus>>(
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
  //       mapUserReactionsForPosts,
  //     );
  //   }
  //
  //   const items: PostViewDto[] = posts.map(
  //     (post: PostDocument): PostViewDto => {
  //       let myStatus: ReactionStatus | undefined;
  //
  //       if (user) {
  //         const id: string = post._id.toString();
  //
  //         myStatus = mapUserReactionsForPosts.get(id);
  //       }
  //
  //       return PostViewDto.mapToView(
  //         post,
  //         myStatus ? myStatus : ReactionStatus.None,
  //       );
  //     },
  //   );
  //
  //   const totalCount: number = await this.PostModel.countDocuments(filter);
  //
  //   return PaginatedViewDto.mapToView<PostViewDto>({
  //     items,
  //     totalCount,
  //     page: query.pageNumber,
  //     size: query.pageSize,
  //   });
  // }
}
