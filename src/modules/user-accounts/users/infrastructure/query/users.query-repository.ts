import { Inject, Injectable } from '@nestjs/common';
import { PG_POOL } from '../../../../database/constants/database.constants';
import { Pool, QueryResult } from 'pg';
import { UserViewDto } from '../../api/view-dto/user.view-dto';
import { UserDbType } from '../../types/user-db.type';
import { DomainException } from 'src/core/exceptions/damain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';
import {
  GetUsersQueryParams,
  UsersSortBy,
} from '../../api/input-dto/get-users-query-params.input-dto';
import { PaginatedViewDto } from 'src/core/dto/paginated.view-dto';
import { ValidationException } from '../../../../../core/exceptions/validation-exception';
import { SortDirection } from '../../../../../core/dto/base.query-params.input-dto';

@Injectable()
export class UsersQueryRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async getByIdOrNotFoundFail(id: number): Promise<UserViewDto> {
    const result: QueryResult<UserDbType> = await this.pool.query(
      `SELECT *
       FROM "Users"
       WHERE id = $1
         AND "deletedAt" IS NULL`,
      [id],
    );

    if (result.rowCount === 0) {
      throw new DomainException({
        code: DomainExceptionCode.NotFound,
        message: 'User not found.',
      });
    }

    return UserViewDto.mapToView(result.rows[0]);
  }

  async getAll(
    query: GetUsersQueryParams,
  ): Promise<PaginatedViewDto<UserViewDto>> {
    const {
      searchLoginTerm,
      searchEmailTerm,
      sortBy,
      sortDirection,
      pageSize,
      pageNumber,
    }: GetUsersQueryParams = query;

    const offset: number = query.calculateSkip();

    if (!Object.values(UsersSortBy).includes(sortBy)) {
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

    const orderByClause = `ORDER BY "${sortBy}" ${sortDirection}`;

    let queryText: string = `SELECT *
                             FROM "Users"
                             WHERE "deletedAt" IS NULL`;
    let countQueryText: string = `SELECT COUNT(*) AS "totalCount"
                                  FROM "Users"
                                  WHERE "deletedAt" IS NULL`;
    const values: any[] = [];

    if (searchLoginTerm !== null || searchEmailTerm !== null) {
      queryText += ` AND (($1 IS NULL OR login ILIKE '%' || $1 || '%') OR ($2 IS NULL OR email ILIKE '%' || $2 || '%'))`;
      countQueryText += ` AND (($1 IS NULL OR login ILIKE '%' || $1 || '%') OR ($2 IS NULL OR email ILIKE '%' || $2 || '%'))`;
      values.push(searchLoginTerm, searchEmailTerm);
    }

    queryText += ` ${orderByClause} OFFSET $${values.length + 1} LIMIT $${values.length + 2}`;
    values.push(offset, pageSize);

    try {
      const users: QueryResult<UserDbType> = await this.pool.query(
        queryText,
        values,
      );
      const totalCount: QueryResult<{ totalCount: number }> =
        await this.pool.query(
          countQueryText,
          values.slice(0, values.length > 2 ? 2 : 0),
        );

      const items: UserViewDto[] = users.rows.map(
        (user: UserDbType): UserViewDto => UserViewDto.mapToView(user),
      );

      return PaginatedViewDto.mapToView<UserViewDto>({
        items,
        totalCount: totalCount.rows[0].totalCount,
        page: pageNumber,
        size: pageSize,
      });
    } catch (error) {
      console.error(
        'Ошибка при выполнении SQL-запроса в методе getAll() (запрос всех пользователей):',
        error,
      );
      throw new DomainException({
        code: DomainExceptionCode.InternalServerError,
        message: 'The list of users could not be retrieved',
      });
    }
  }
}
