import { ReactionStatus } from '../../../reactions/types/reaction-db.type';
import { RawPost } from '../../infrastructure/query/types/raw-post.type';

export type NewestLikes = {
  addedAt: string;
  userId: string;
  login: string;
};

export type ExtendedReactionsInfo = {
  likesCount: number;
  dislikesCount: number;
  myStatus: ReactionStatus;
  newestLikes: NewestLikes[];
};

export class PostViewDto {
  id: string;
  title: string;
  shortDescription: string;
  content: string;
  blogId: string;
  blogName: string;
  extendedLikesInfo: ExtendedReactionsInfo;
  createdAt: string;

  static mapRawPostToPostViewDto(post: RawPost): PostViewDto {
    const dto = new this();
    dto.id = post.id.toString();
    dto.title = post.title;
    dto.shortDescription = post.shortDescription;
    dto.content = post.content;
    dto.blogId = post.blogId.toString();
    dto.blogName = post.blogName;
    dto.extendedLikesInfo = {
      likesCount: +post.likesCount,
      dislikesCount: +post.dislikesCount,
      myStatus: post.myStatus ?? ReactionStatus.None,
      newestLikes: post.newestLikes.map((nl) => {
        return {
          addedAt: nl.addedAt,
          userId: nl.userId.toString(),
          login: nl.login,
        };
      }),
    };
    dto.createdAt = post.createdAt.toISOString();

    return dto;
  }
}
