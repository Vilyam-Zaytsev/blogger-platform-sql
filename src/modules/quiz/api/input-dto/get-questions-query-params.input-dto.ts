import { BaseQueryParams } from '../../../../core/dto/base.query-params.input-dto';
import { IsEnum, IsOptional } from 'class-validator';
import { IsStringWithTrimDecorator } from '../../../../core/decorators/validation/is-string-with-trim.decorator';
import { bodyConstraints } from '../../domain/entities/question.entity';

export enum QuestionsSortBy {
  CreatedAt = 'createdAt',
  UpdatedAt = 'updatedAt',
  DeletedAt = 'deletedAt',
  Body = 'body',
  Status = 'status',
}

export enum InputPublishedStatus {
  NotPublished = 'notPublished',
  Published = 'published',
  All = 'all',
}

export class GetQuestionsQueryParams extends BaseQueryParams<QuestionsSortBy> {
  @IsEnum(QuestionsSortBy)
  sortBy: QuestionsSortBy = QuestionsSortBy.CreatedAt;

  @IsStringWithTrimDecorator(0, bodyConstraints.maxLength)
  @IsOptional()
  bodySearchTerm: string | null = null;

  @IsEnum(InputPublishedStatus)
  publishedStatus: InputPublishedStatus = InputPublishedStatus.All;
}
