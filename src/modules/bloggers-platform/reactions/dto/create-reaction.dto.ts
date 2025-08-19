import { ReactionStatus } from '../types/reaction-db.type';

export class CreateReactionDto {
  status: ReactionStatus;
  userId: number;
  parentId: number;
}
