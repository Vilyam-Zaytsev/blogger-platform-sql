import { Inject, Injectable } from '@nestjs/common';
import { BlogViewDto } from '../../api/view-dto/blog-view.dto';
import { Pool, QueryResult } from 'pg';
import { PG_POOL } from '../../../../database/constants/database.constants';
import { BlogDbType } from '../../types/blog-db.type';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';
import {
  BlogsSortBy,
  GetBlogsQueryParams,
} from '../../api/input-dto/get-blogs-query-params.input-dto';
import { PaginatedViewDto } from '../../../../../core/dto/paginated.view-dto';
import { SearchFilterBuilder } from '../../../../../core/utils/search-filter.builder';
import { ValidationException } from '../../../../../core/exceptions/validation-exception';
import { SortDirection } from '../../../../../core/dto/base.query-params.input-dto';
import { BlogRawRow } from '../../types/blog-raw-row.type';

@Injectable()
export class BlogsQueryRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async getByIdOrNotFoundFail(id: number): Promise<BlogViewDto> {
    const { rows }: QueryResult<BlogDbType> = await this.pool.query(
      `
        SELECT *
        FROM "Blogs"
        WHERE "id" = $1
          AND "deletedAt" IS NULL
      `,
      [id],
    );

    if (rows.length === 0) {
      throw new DomainException({
        code: DomainExceptionCode.NotFound,
        message: `The blog with ID (${id}) does not exist`,
      });
    }

    return BlogViewDto.mapToView(rows[0]);
  }

  async getAll(query: GetBlogsQueryParams): Promise<PaginatedViewDto<BlogViewDto>> {
    const { sortBy, sortDirection, pageSize, pageNumber, searchNameTerm }: GetBlogsQueryParams =
      query;

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

    const offset: number = query.calculateSkip();
    const { condition: searchCondition, values: searchValues } =
      SearchFilterBuilder.buildBlogsSearchFilter(searchNameTerm);
    const offsetParamIndex: number = searchValues.length + 1;
    const limitParamIndex: number = searchValues.length + 2;

    try {
      const { rows }: QueryResult<BlogRawRow> = await this.pool.query(
        `
          SELECT COUNT(*) OVER() AS "totalCount", b."id"::text, b."name",
                 b."description",
                 b."websiteUrl",
                 b."createdAt"::text, b."isMembership"
          FROM "Blogs" b
          WHERE "deletedAt" IS NULL
            ${searchCondition ? `AND (${searchCondition})` : ''}
          ORDER BY "${sortBy}" ${sortDirection.toUpperCase()}
          OFFSET $${offsetParamIndex} LIMIT $${limitParamIndex};
        `,
        [...searchValues, offset, pageSize],
      );

      const totalCount: number = rows.length > 0 ? +rows[0].totalCount : 0;
      const pagesCount: number = Math.ceil(totalCount / pageSize);

      return {
        pagesCount,
        page: pageNumber,
        pageSize,
        totalCount,
        items: rows.map(
          (row): BlogViewDto => ({
            id: row.id,
            name: row.name,
            description: row.description,
            websiteUrl: row.websiteUrl,
            createdAt: row.createdAt,
            isMembership: row.isMembership,
          }),
        ),
      };
    } catch (error) {
      console.error('Ошибка при выполнении SQL-запроса в BlogsQueryRepository.getAll():', error);

      throw error;
    }
  }
}
