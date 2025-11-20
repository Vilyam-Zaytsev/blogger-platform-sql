import { Injectable } from '@nestjs/common';
import { Question } from '../../domain/entities/question.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { QuestionViewDto } from '../../api/view-dto/question.view-dto';
import { RawQuestion } from '../types/raw-question.type';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';
import { PaginatedViewDto } from '../../../../../core/dto/paginated.view-dto';
import {
  GetQuestionsQueryParams,
  QuestionInputStatus,
} from '../../api/input-dto/get-questions-query-params.input-dto';
import { TypeId } from '../../../types/type-id.type';

@Injectable()
export class QuestionsQueryRepository {
  constructor(@InjectRepository(Question) private readonly repository: Repository<Question>) {}

  async getByIdOrNotFoundFail(id: number | string, typeId: TypeId): Promise<QuestionViewDto> {
    const qb = this.repository
      .createQueryBuilder('question')
      .select([
        'question.public_id AS id',
        'question.body AS body',
        'question.correct_answers AS "correctAnswers"',
        'question.status AS status',
        'question.created_at AS "createdAt"',
        'question.updated_at AS "updatedAt"',
      ])
      .where(`question.${typeId} = :id`, { id });

    const question: RawQuestion | null = (await qb.getRawOne()) ?? null;

    if (!question) {
      throw new DomainException({
        code: DomainExceptionCode.NotFound,
        message: `The question with ID (${id}) does not exist`,
      });
    }

    return QuestionViewDto.mapToView(question);
  }

  async getAll(queryParams: GetQuestionsQueryParams): Promise<PaginatedViewDto<QuestionViewDto>> {
    const {
      sortBy,
      sortDirection,
      pageSize,
      pageNumber,
      bodySearchTerm,
      publishedStatus,
    }: GetQuestionsQueryParams = queryParams;
    const skip: number = queryParams.calculateSkip();

    const qb = this.repository
      .createQueryBuilder('question')
      .select([
        'question.public_id AS id',
        'question.body AS body',
        'question.correct_answers AS "correctAnswers"',
        'question.status AS status',
        'question.created_at AS "createdAt"',
        'question.updated_at AS "updatedAt"',
      ]);

    if (bodySearchTerm) {
      qb.andWhere('question.body ILIKE :body', { body: `%${bodySearchTerm}%` });
    }

    if (publishedStatus !== QuestionInputStatus.All) {
      qb.andWhere('question.status = :status', { status: publishedStatus });
    }

    qb.orderBy(`question.${sortBy}`, sortDirection.toUpperCase() as 'ASC' | 'DESC');
    qb.skip(skip).take(pageSize);

    const rawQuestions: RawQuestion[] = await qb.getRawMany();
    const totalCount: number = await qb.getCount();
    const pagesCount: number = Math.ceil(totalCount / pageSize);

    return {
      pagesCount,
      page: pageNumber,
      pageSize,
      totalCount,
      items: rawQuestions.map((question) => QuestionViewDto.mapToView(question)),
    };
  }
}
