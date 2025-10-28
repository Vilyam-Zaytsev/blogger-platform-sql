import { PlayerProgressViewDto } from './player-progress.view-dto';
import { GameStatus } from '../../domain/entities/game.entity';

//TODO: вынести в Question
export class QuestionsForGameViewDto {
  id: string;
  body: string;
}

export class GameViewDto {
  id: string;
  firstPlayerProgress: PlayerProgressViewDto;
  secondPlayerProgress: PlayerProgressViewDto;
  questions: QuestionsForGameViewDto[];
  status: GameStatus;
  pairCreatedDate: string;
  startGameDate: string | null;
  finishGameDate: string | null;
}
