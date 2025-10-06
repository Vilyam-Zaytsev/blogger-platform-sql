import { IsEnum } from 'class-validator';
import { ReactionStatus } from '../../domain/entities/reaction.entity';

export class ReactionInputDto {
  @IsEnum(ReactionStatus)
  likeStatus: ReactionStatus;
}
