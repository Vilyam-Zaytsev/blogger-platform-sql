import { ReactionStatus } from '../../../../reactions/domain/entities/reaction.entity';

export type RawComment = {
  id: number;
  content: string;
  createdAt: Date;
  userId: number;
  userLogin: string;
  likesCount: number;
  dislikesCount: number;
  myStatus: ReactionStatus;
};
