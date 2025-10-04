import { ReactionStatus } from '../../../../reactions/types/reaction-db.type';

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
  newestLikes: {
    addedAt: string;
    userId: number;
    login: string;
  }[];
  myStatus: ReactionStatus;
};
