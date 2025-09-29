import { ReactionStatus } from '../../../../reactions/types/reaction-db.type';
import { NewestLikes } from '../../../types/newest-likes.type';

export type RawPost = {
  id: number;
  title: string;
  shortDescription: string;
  content: string;
  createdAt: Date;
  blogId: string;
  blogName: string;
  likesCount: number;
  dislikesCount: number;
  newestLikes: NewestLikes[];
  myStatus: ReactionStatus;
};

export type RawPostWithCount = RawPost & {
  totalCount: string;
};
