import { CommentatorInfo } from '../../types/commentator-info.type';
import { ReactionStatus } from '../../../reactions/types/reaction-db.type';
import { ReactionsCount } from '../../types/reactions-count.type';

export class CommentViewDto {
  id: string;
  content: string;
  commentatorInfo: CommentatorInfo;
  likesInfo: ReactionsCount & { myStatus: ReactionStatus };
  createdAt: string;
}
