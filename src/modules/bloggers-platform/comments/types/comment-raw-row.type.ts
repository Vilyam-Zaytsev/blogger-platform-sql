import { ReactionsCount } from './reactions-count.type';
import { ReactionStatus } from '../../reactions/types/reaction-db.type';
import { CommentatorInfo } from '../api/view-dto/comment-view.dto';

export type CommentRawRow = {
  totalCount: number;
  id: string;
  content: string;
  commentatorInfo: CommentatorInfo;
  createdAt: string;
  likesInfo: ReactionsCount & { myStatus: ReactionStatus };
};
