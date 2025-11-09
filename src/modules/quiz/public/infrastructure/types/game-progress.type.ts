export type GameProgress = {
  gameId: number;
  playerId: number;
  questionsCount: number;
  answersCount: number;
  questions: DetailsOfQuestion[];
};

export type DetailsOfQuestion = {
  gameQuestionId: number;
  questionPublicId: string;
  body: string;
  order: number;
  correctAnswers: string[];
};
