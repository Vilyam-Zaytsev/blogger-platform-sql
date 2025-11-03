import { AnswerStatus } from '../../../domain/entities/answer.entity';
import { GameStatus } from '../../../domain/entities/game.entity';

export type RawGame = {
  id: string;

  firstPlayerProgress: {
    answers: {
      questionId: string;
      answerStatus: AnswerStatus;
      addedAt: Date;
    }[];
    player: {
      id: number;
      login: string;
    };
    score: number;
  };

  secondPlayerProgress: {
    answers: {
      questionId: string;
      answerStatus: AnswerStatus;
      addedAt: Date;
    }[];
    player: {
      id: number;
      login: string;
    };
    score: number;
  };

  questions: {
    id: string;
    body: string;
  }[];

  status: GameStatus;

  pairCreatedDate: Date;
  startGameDate: Date | null;
  finishGameDate: Date | null;
};
