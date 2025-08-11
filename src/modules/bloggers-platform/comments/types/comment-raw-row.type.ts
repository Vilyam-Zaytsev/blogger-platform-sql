import { CommentatorInfo } from './commentator-info.type';
import { ReactionsCount } from './reactions-count.type';
import { ReactionStatus } from '../../reactions/types/reaction-db.type';

export type CommentRawRow = {
  totalCount: number;
  id: string;
  content: string;
  commentatorInfo: CommentatorInfo;
  createdAt: string;
  likesInfo: ReactionsCount & { myStatus: ReactionStatus };
};
