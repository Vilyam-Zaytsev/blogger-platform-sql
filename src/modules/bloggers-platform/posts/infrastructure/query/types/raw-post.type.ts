import { ReactionStatus } from '../../../../reactions/domain/entities/reaction.entity';

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
  myStatus: ReactionStatus | null;
};
