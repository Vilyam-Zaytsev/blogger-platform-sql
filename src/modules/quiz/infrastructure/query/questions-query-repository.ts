import { Injectable } from '@nestjs/common';
import { Question } from '../../domain/entities/question.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { QuestionViewDto } from '../../api/view-dto/question.view-dto';
import { RawQuestion } from '../types/raw-question.type';
import { DomainException } from '../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../core/exceptions/domain-exception-codes';

@Injectable()
export class QuestionsQueryRepository {
  constructor(@InjectRepository(Question) private readonly repository: Repository<Question>) {}

  async getByIdOrNotFoundFail(id: number): Promise<QuestionViewDto> {
    const question: RawQuestion | null =
      (await this.repository
        .createQueryBuilder('question')
        .select([
          'question.id AS "id"',
          'question.body AS "body"',
          'question.correctAnswers AS "correctAnswers"',
          'question.status AS "status"',
          'question.createdAt AS "createdAt"',
          'question.updatedAt AS "updatedAt"',
        ])
        .where('question.id = :id', { id })
        .getRawOne()) ?? null;

    if (!question) {
      throw new DomainException({
        code: DomainExceptionCode.NotFound,
        message: `The question with ID (${id}) does not exist`,
      });
    }

    return QuestionViewDto.mapToView(question);
  }
}
