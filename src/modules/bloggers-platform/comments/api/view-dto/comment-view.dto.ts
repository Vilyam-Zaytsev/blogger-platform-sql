import { ReactionStatus } from '../../../reactions/types/reaction-db.type';

export type CommentatorInfo = {
  userId: string;
  userLogin: string;
};

export type ReactionsInfo = {
  likesCount: number;
  dislikesCount: number;
  myStatus: ReactionStatus;
};

export class CommentViewDto {
  id: string;
  content: string;
  commentatorInfo: CommentatorInfo;
  likesInfo: ReactionsInfo;
  createdAt: string;
}
