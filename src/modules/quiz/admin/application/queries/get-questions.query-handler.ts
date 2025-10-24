import { GetQuestionsQueryParams } from '../../api/input-dto/get-questions-query-params.input-dto';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PaginatedViewDto } from '../../../../../core/dto/paginated.view-dto';
import { QuestionViewDto } from '../../api/view-dto/question.view-dto';
import { QuestionsQueryRepository } from '../../infrastructure/query/questions-query-repository';

export class GetQuestionsQuery {
  constructor(public readonly queryParams: GetQuestionsQueryParams) {}
}

@QueryHandler(GetQuestionsQuery)
export class GetQuestionQueryHandler
  implements IQueryHandler<GetQuestionsQuery, PaginatedViewDto<QuestionViewDto>>
{
  constructor(private readonly questionsQueryRepository: QuestionsQueryRepository) {}

  async execute({ queryParams }: GetQuestionsQuery): Promise<PaginatedViewDto<QuestionViewDto>> {
    return this.questionsQueryRepository.getAll(queryParams);
  }
}
