import { Inject, Injectable } from '@nestjs/common';
import { PG_POOL } from '../../../../database/constants/database.constants';
import { Pool, QueryResult } from 'pg';
import { UserViewDto } from '../../api/view-dto/user.view-dto';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';
import {
  GetUsersQueryParams,
  UsersSortBy,
} from '../../api/input-dto/get-users-query-params.input-dto';
import { ValidationException } from '../../../../../core/exceptions/validation-exception';
import { SortDirection } from '../../../../../core/dto/base.query-params.input-dto';
import { PaginatedViewDto } from '../../../../../core/dto/paginated.view-dto';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { SearchFilterBuilder } from '../../../../../core/utils/search-filter.builder';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../../domain/entities/user.entity';
import { Repository } from 'typeorm';

@Injectable()
export class UsersQueryRepository {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    @InjectRepository(User) private readonly repository: Repository<User>,
  ) {}

  async getByIdOrNotFoundFail(id: number): Promise<UserViewDto> {
    const user: User = await this.repository.findOneByOrFail({ id: id });

    return UserViewDto.mapToView(user);
  }

  async getAll2(query: GetUsersQueryParams) {
    const skip: number = query.calculateSkip();

    const users: User[] = await this.repository.find();
  }

  async getAll(query: GetUsersQueryParams): Promise<PaginatedViewDto<UserViewDto>> {
    const {
      sortBy,
      sortDirection,
      pageSize,
      pageNumber,
      searchLoginTerm,
      searchEmailTerm,
    }: GetUsersQueryParams = query;
    const offset: number = query.calculateSkip();
    const { condition: searchCondition, values: searchValues } =
      SearchFilterBuilder.buildUserSearchFilter(searchLoginTerm, searchEmailTerm);
    const offsetParamIndex: number = searchValues.length + 1;
    const limitParamIndex: number = searchValues.length + 2;

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

    try {
      const users: QueryResult<User> = await this.pool.query(
        `SELECT *
         FROM "Users"
         WHERE "deletedAt" IS NULL
           ${searchCondition ? `AND (${searchCondition})` : ''}
         ORDER BY "${sortBy}" ${sortDirection.toUpperCase()}
         OFFSET $${offsetParamIndex} LIMIT $${limitParamIndex};`,
        [...searchValues, offset, pageSize],
      );

      const totalCountResult: QueryResult<{ totalCount: number }> = await this.pool.query(
        `SELECT COUNT(*) AS "totalCount"
           FROM "Users"
           WHERE "deletedAt" IS NULL
             ${searchCondition ? `AND (${searchCondition})` : ''}`,
        [...searchValues],
      );

      const items: UserViewDto[] = users.rows.map(
        (user: User): UserViewDto => UserViewDto.mapToView(user),
      );

      const totalCount: number = Number(totalCountResult.rows[0].totalCount);

      return PaginatedViewDto.mapToView<UserViewDto>({
        items,
        totalCount: totalCount,
        page: pageNumber,
        size: pageSize,
      });
    } catch (error) {
      console.error('Ошибка при выполнении SQL-запроса в UsersQueryRepository.getAll():', error);
      throw new DomainException({
        code: DomainExceptionCode.InternalServerError,
        message: 'The list of users could not be retrieved',
      });
    }
  }
}
