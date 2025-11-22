import { QuestionStatus } from '../../domain/entities/question.entity';

export type RawQuestion = {
  id: string;
  body: string;
  correctAnswers: string[];
  status: QuestionStatus;
  createdAt: Date;
  updatedAt: Date;
};
