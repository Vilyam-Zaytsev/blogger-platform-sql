import { ReactionStatus } from '../../reactions/types/reaction-db.type';
import { NewestLikes } from './newest-likes.type';

export type PostRawRow = {
  totalCount: string;
  id: string;
  title: string;
  shortDescription: string;
  content: string;
  blogId: string;
  blogName: string;
  createdAt: string;
  extendedLikesInfo: {
    likesCount: number;
    dislikesCount: number;
    myStatus: ReactionStatus;
    newestLikes: NewestLikes[];
  };
};
