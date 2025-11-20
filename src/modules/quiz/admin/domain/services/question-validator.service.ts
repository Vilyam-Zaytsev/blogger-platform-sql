import { Injectable } from '@nestjs/common';
import { Question, QuestionStatus } from '../entities/question.entity';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';
import { ValidationException } from '../../../../../core/exceptions/validation-exception';

@Injectable()
export class QuestionValidatorService {
  validateQuestionExists(question: Question | null, id: string): Question {
    if (!question) {
      throw new DomainException({
        code: DomainExceptionCode.NotFound,
        message: `The question with ID (${id}) does not exist`,
      });
    }

    return question;
  }

  validateNotAlreadyPublished(question: Question): void {
    if (question.status === QuestionStatus.Published) {
      throw new DomainException({
        code: DomainExceptionCode.BadRequest,
        message: `The question with ID (${question.publicId}) already published`,
      });
    }
  }

  validateAlreadyPublished(question: Question): void {
    if (question.status === QuestionStatus.NotPublished) {
      throw new DomainException({
        code: DomainExceptionCode.BadRequest,
        message: `In order to remove a question from publication, it must be published`,
      });
    }
  }

  validateHasCorrectAnswers(question: Question): void {
    if (question.correctAnswers.length < 1) {
      throw new ValidationException([
        {
          message: `Cannot publish question without correct answers`,
          field: 'correctAnswers',
        },
      ]);
    }
  }

  validateBeforePublish(question: Question | null, id: string): Question {
    const existingQuestion: Question = this.validateQuestionExists(question, id);
    this.validateNotAlreadyPublished(existingQuestion);
    this.validateHasCorrectAnswers(existingQuestion);

    return existingQuestion;
  }

  validateBeforeRemovePublication(question: Question | null, id: string): Question {
    const existingQuestion: Question = this.validateQuestionExists(question, id);
    this.validateAlreadyPublished(existingQuestion);

    return existingQuestion;
  }
}
