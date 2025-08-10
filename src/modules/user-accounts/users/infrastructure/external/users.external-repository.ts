import { Inject, Injectable } from '@nestjs/common';
import { PG_POOL } from '../../../../database/constants/database.constants';
import { Pool, QueryResult } from 'pg';
import { UserDbType } from '../../types/user-db.type';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';

@Injectable()
export class UsersExternalRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async getByIdOrNotFoundFail(id: number): Promise<UserDbType> {
    const queryResult: QueryResult<UserDbType> =
      await this.pool.query<UserDbType>(
        `SELECT *
         FROM "Users"
         WHERE id = $1
           AND "deletedAt" IS NULL`,
        [id],
      );

    if (!queryResult.rows[0]) {
      throw new DomainException({
        code: DomainExceptionCode.NotFound,
        message: `The user with ID (${id}) does not exist`,
      });
    }

    return queryResult.rows[0];
  }
}
