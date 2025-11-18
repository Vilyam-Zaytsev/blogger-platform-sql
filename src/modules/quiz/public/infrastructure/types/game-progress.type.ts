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

export type PlayerProgress = {
  playerId: number;
  answersCount: number;
  score: number;
};
