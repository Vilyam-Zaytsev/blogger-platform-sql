import { IsEnum, IsOptional } from 'class-validator';
import { BaseQueryParams } from '../../../../../core/dto/base.query-params.input-dto';
import { IsStringWithTrimDecorator } from '../../../../../core/decorators/validation/is-string-with-trim.decorator';
import { nameConstraints } from '../../domain/entities/blog.entity';

export enum BlogsSortBy {
  CreatedAt = 'createdAt',
  UpdatedAt = 'updatedAt',
  DeletedAt = 'deletedAt',
  Name = 'name',
}

export class GetBlogsQueryParams extends BaseQueryParams<BlogsSortBy> {
  @IsEnum(BlogsSortBy)
  sortBy: BlogsSortBy = BlogsSortBy.CreatedAt;

  @IsStringWithTrimDecorator(1, nameConstraints.maxLength)
  @IsOptional()
  searchNameTerm: string | null = null;
}
