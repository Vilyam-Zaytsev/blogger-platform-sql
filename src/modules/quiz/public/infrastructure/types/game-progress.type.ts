import { AnswerStatus } from '../../domain/entities/answer.entity';

export type GameProgress = {
  gameId: number;
  questions: DetailsOfQuestion[];
  progressCurrentPlayer: PlayerProgress;
  progressOpponent: PlayerProgress;
};

export type DetailsOfQuestion = {
  gameQuestionId: number;
  questionPublicId: string;
  body: string;
  order: number;
  correctAnswers: string[];
};

export type DetailsOfAnswers = {
  status: AnswerStatus;
  addedAt: string;
};

export type PlayerProgress = {
  playerId: number;
  answers: DetailsOfAnswers[];
  score: number;
};
