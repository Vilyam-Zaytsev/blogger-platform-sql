import { Question, QuestionStatus } from '../../domain/entities/question.entity';
import { RawQuestion } from '../../infrastructure/types/raw-question.type';

export class QuestionViewDto {
  id: string;
  body: string;
  correctAnswers: string[];
  published: boolean;
  createdAt: string;
  updatedAt: string;

  static mapToView(question: Question | RawQuestion): QuestionViewDto {
    const dto = new this();

    dto.id = question.id.toString();
    dto.body = question.body;
    dto.correctAnswers = question.correctAnswers;
    dto.published = question.status === QuestionStatus.Published;
    dto.createdAt = question.createdAt.toISOString();
    dto.updatedAt = question.updatedAt.toISOString();

    return dto;
  }
}
