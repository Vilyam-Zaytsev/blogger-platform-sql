import { Inject, Injectable } from '@nestjs/common';
import { SessionViewDto } from '../../api/view-dto/session.view-dto';
import { PG_POOL } from '../../../../database/constants/database.constants';
import { Pool } from 'pg';
import { SessionDbType } from '../../../auth/types/session-db.type';

@Injectable()
export class SessionsQueryRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async getAllByUserId(userId: number): Promise<SessionViewDto[]> {
    const { rows } = await this.pool.query(
      `SELECT *
       FROM "Sessions"
       WHERE "userId" = $1
         AND "deletedAt" IS NULL
       ORDER BY "id" ASC
       `,
      [userId],
    );

    return rows.map(
      (session: SessionDbType): SessionViewDto =>
        SessionViewDto.mapToView(session),
    );
  }
}
