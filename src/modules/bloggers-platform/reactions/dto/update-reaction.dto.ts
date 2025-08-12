import { ReactionStatus } from '../types/reaction-db.type';

export class UpdateReactionDto {
  status: ReactionStatus;
  userId: number;
  parentId: number;
}
