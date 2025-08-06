import { ReactionStatus } from '../../../reactions/types/reaction-db.type';
import { NewestLikes } from '../../types/newest-likes.type';

export class PostViewDto {
  id: string;
  title: string;
  shortDescription: string;
  content: string;
  blogId: string;
  blogName: string;
  extendedLikesInfo: ExtendedReactionsInfo;
  createdAt: string;

  // static mapToView(post: PostDocument, myStatus: ReactionStatus): PostViewDto {
  //   const dto = new this();
  //
  //   dto.id = post._id.toString();
  //   dto.title = post.title;
  //   dto.shortDescription = post.shortDescription;
  //   dto.content = post.content;
  //   dto.blogId = post.blogId;
  //   dto.blogName = post.blogName;
  //   dto.extendedLikesInfo = {
  //     likesCount: post.reactionsCount.likesCount,
  //     dislikesCount: post.reactionsCount.dislikesCount,
  //     myStatus,
  //     newestLikes: post.newestLikes,
  //   };
  //   dto.createdAt = post.createdAt.toISOString();
  //
  //   return dto;
  // }
}

export type ExtendedReactionsInfo = {
  likesCount: number;
  dislikesCount: number;
  myStatus: ReactionStatus;
  newestLikes: NewestLikes[];
};
