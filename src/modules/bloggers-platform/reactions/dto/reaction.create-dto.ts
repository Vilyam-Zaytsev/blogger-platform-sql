import { ReactionStatus } from '../types/reaction-db.type';

export class ReactionCreateDto {
  status: ReactionStatus;
  userId: number;
  parentId: number;
}

export class ReactionUpdateDto extends ReactionCreateDto {}
