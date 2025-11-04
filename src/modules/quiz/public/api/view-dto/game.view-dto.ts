import { PlayerProgressViewDto } from './player-progress.view-dto';
import { GameStatus } from '../../domain/entities/game.entity';
import { QuestionsForGameViewDto } from '../../../admin/api/view-dto/question.view-dto';
import { RawGame } from '../../infrastructure/query/types/raw-game.type';

export class GameViewDto {
  id: string;
  firstPlayerProgress: PlayerProgressViewDto;
  secondPlayerProgress: PlayerProgressViewDto | null;
  questions: QuestionsForGameViewDto[];
  status: GameStatus;
  pairCreatedDate: string;
  startGameDate: string | null;
  finishGameDate: string | null;

  static mapToView(game: RawGame): GameViewDto {
    const dto = new this();

    dto.id = game.id;

    dto.firstPlayerProgress = {
      answers: game.firstPlayerProgress.answers.map((a) => ({
        questionId: a.questionId,
        answerStatus: a.answerStatus,
        addedAt: a.addedAt.toISOString(),
      })),
      player: {
        id: game.firstPlayerProgress.player.id.toString(),
        login: game.firstPlayerProgress.player.login,
      },
      score: game.firstPlayerProgress.score,
    };

    dto.secondPlayerProgress = game.secondPlayerProgress
      ? {
          answers: game.secondPlayerProgress.answers.map((a) => ({
            questionId: a.questionId,
            answerStatus: a.answerStatus,
            addedAt: a.addedAt.toISOString(),
          })),
          player: {
            id: game.secondPlayerProgress.player.id.toString(),
            login: game.secondPlayerProgress.player.login,
          },
          score: game.secondPlayerProgress.score,
        }
      : game.secondPlayerProgress;

    dto.questions = game.questions;
    dto.status = game.status;

    dto.pairCreatedDate = game.pairCreatedDate.toISOString();
    dto.startGameDate = game.startGameDate ? game.startGameDate.toISOString() : game.startGameDate;
    dto.finishGameDate = game.finishGameDate
      ? game.finishGameDate.toISOString()
      : game.finishGameDate;

    return dto;
  }
}
