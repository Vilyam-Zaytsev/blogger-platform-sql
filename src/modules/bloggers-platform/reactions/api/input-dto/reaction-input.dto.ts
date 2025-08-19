import { IsEnum } from 'class-validator';
import { ReactionStatus } from '../../types/reaction-db.type';

export class ReactionInputDto {
  @IsEnum(ReactionStatus)
  likeStatus: ReactionStatus;
}
