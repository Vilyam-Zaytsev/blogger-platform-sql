import { Injectable } from '@nestjs/common';
import { QueryResult } from 'pg';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';
import {
  BlogsSortBy,
  GetBlogsQueryParams,
} from '../../api/input-dto/get-blogs-query-params.input-dto';
import { PaginatedViewDto } from '../../../../../core/dto/paginated.view-dto';
import { ValidationException } from '../../../../../core/exceptions/validation-exception';
import { SortDirection } from '../../../../../core/dto/base.query-params.input-dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Blog } from '../../domain/entities/blog.entity';
import { Repository } from 'typeorm';
import { BlogViewDto } from '../../api/view-dto/blog.view-dto';

@Injectable()
export class BlogsQueryRepository {
  constructor(@InjectRepository(Blog) private readonly repository: Repository<Blog>) {}

  async getByIdOrNotFoundFail(id: number): Promise<BlogViewDto> {
    const blog: Blog | null = await this.repository.findOneBy({ id });

    if (!blog) {
      throw new DomainException({
        code: DomainExceptionCode.NotFound,
        message: `The blog with ID (${id}) does not exist`,
      });
    }

    return BlogViewDto.mapToView(blog);
  }

  async getAll(queryParams: GetBlogsQueryParams): Promise<PaginatedViewDto<BlogViewDto>> {
    const { sortBy, sortDirection, pageSize, pageNumber, searchNameTerm }: GetBlogsQueryParams =
      queryParams;

    if (!Object.values(BlogsSortBy).includes(sortBy)) {
      throw new ValidationException([
        {
          message: `Invalid sortBy: ${sortBy}`,
          field: 'sortBy',
        },
      ]);
    }

    if (!Object.values(SortDirection).includes(sortDirection)) {
      throw new ValidationException([
        {
          message: `Invalid sortDirection: ${sortDirection}`,
          field: 'sortDirection',
        },
      ]);
    }

    const offset: number = queryParams.calculateSkip();
    const { condition: searchCondition, values: searchValues } =
      SearchFilterBuilder.buildBlogsSearchFilter(searchNameTerm);
    const offsetParamIndex: number = searchValues.length + 1;
    const limitParamIndex: number = searchValues.length + 2;

    const query = `
      SELECT *, COUNT(*) OVER() AS "totalCount"
      FROM "Blogs"
      WHERE "deletedAt" IS NULL ${searchCondition ? `AND (${searchCondition})` : ''}
      ORDER BY "${sortBy}" ${sortDirection.toUpperCase()}
      OFFSET $${offsetParamIndex} LIMIT $${limitParamIndex};
    `;

    const { rows }: QueryResult<BlogDbWithTotalCount> = await this.pool.query(query, [
      ...searchValues,
      offset,
      pageSize,
    ]);

    const totalCount: number = rows.length > 0 ? +rows[0].totalCount : 0;
    const pagesCount: number = Math.ceil(totalCount / pageSize);

    return {
      pagesCount,
      page: pageNumber,
      pageSize,
      totalCount,
      items: rows.map((row) => BlogViewDto.mapToView(row)),
    };
  }
}
