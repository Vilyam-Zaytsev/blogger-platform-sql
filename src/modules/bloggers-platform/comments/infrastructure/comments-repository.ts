import { Inject, Injectable } from '@nestjs/common';
import { DomainExceptionCode } from '../../../../core/exceptions/domain-exception-codes';
import { PG_POOL } from '../../../database/constants/database.constants';
import { Pool, QueryResult } from 'pg';
import { CommentDbType } from '../types/comment-db.type';
import { DomainException } from '../../../../core/exceptions/domain-exceptions';

@Injectable()
export class CommentsRepository {
  constructor(@Inject(PG_POOL) private readonly poll: Pool) {}

  async getByIdOrNotFoundFail(id: number): Promise<CommentDbType> {
    const { rows }: QueryResult<CommentDbType> = await this.poll.query(
      `
        SELECT *
        FROM "Comments"
        WHERE "id" = $1
          AND "deletedAt" IS NULL
      `,
      [id],
    );

    if (rows.length === 0) {
      throw new DomainException({
        code: DomainExceptionCode.NotFound,
        message: `The comment with ID (${id}) does not exist`,
      });
    }

    return rows[0];
  }
}
