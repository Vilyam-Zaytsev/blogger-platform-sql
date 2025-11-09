import { AnswerStatus } from '../../domain/entities/answer.entity';

export class AnswerViewDto {
  questionId: string;
  answerStatus: AnswerStatus;
  addedAt: string;
}
