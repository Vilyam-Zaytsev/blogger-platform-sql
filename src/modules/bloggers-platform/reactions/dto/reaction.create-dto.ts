import { ReactionStatus } from '../domain/entities/reaction.entity';

export class ReactionCreateDto {
  status: ReactionStatus;
  userId: number;
  parentId: number;
}

export class ReactionUpdateDto extends ReactionCreateDto {}
