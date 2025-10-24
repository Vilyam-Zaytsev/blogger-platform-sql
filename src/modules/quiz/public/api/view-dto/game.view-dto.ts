import { PlayerProgressViewDto } from './player-progress.view-dto';

//TODO: вынести в Question
export class QuestionsForGameViewDto {
  id: string;
  body: string;
}

//TODO: вынести в Game
export enum GameStatus {
  Pending = 'PendingSecondPlayer',
  Active = 'Active',
  Finished = 'Finished',
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
