import { AnswerViewDto } from './answer.view-dto';
import { PlayerViewDto } from './player.view-dto';

export class PlayerProgressViewDto {
  answers: AnswerViewDto[];
  player: PlayerViewDto;
  score: number;
}
