import { CommentatorInfo } from './commentator-info.type';
import { ReactionsCount } from './reactions-count.type';

export type CommentDbType = {
  id: number;
  postId: number;
  content: string;
  commentatorInfo: CommentatorInfo;
  reactionsCount: ReactionsCount;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};
