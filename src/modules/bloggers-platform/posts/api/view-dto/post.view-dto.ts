import { ReactionStatus } from '../../../reactions/types/reaction-db.type';
import { NewestLikes } from '../../types/newest-likes.type';
import { RawPost } from '../../infrastructure/query/types/raw-post.type';

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
      myStatus: post.myStatus,
      newestLikes: post.newestLikes,
    };
    dto.createdAt = post.createdAt.toISOString();

    return dto;
  }
}
