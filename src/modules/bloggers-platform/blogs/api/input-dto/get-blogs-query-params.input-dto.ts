import { IsEnum, IsOptional, IsString } from 'class-validator';
import { BaseQueryParams } from '../../../../../core/dto/base.query-params.input-dto';

export enum BlogsSortBy {
  CreatedAt = 'createdAt',
  UpdatedAt = 'updatedAt',
  DeletedAt = 'deletedAt',
  Name = 'name',
}

export class GetBlogsQueryParams extends BaseQueryParams<BlogsSortBy> {
  @IsEnum(BlogsSortBy)
  sortBy: BlogsSortBy = BlogsSortBy.CreatedAt;

  @IsString()
  @IsOptional()
  searchNameTerm: string | null = null;
}
