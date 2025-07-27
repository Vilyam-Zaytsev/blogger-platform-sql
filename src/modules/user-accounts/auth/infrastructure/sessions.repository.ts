import { Inject, Injectable } from '@nestjs/common';
import { PG_POOL } from '../../../database/constants/database.constants';
import { Pool, QueryResult } from 'pg';
import { CreateSessionDomainDto } from '../domain/dto/create-session.domain.dto';
import { SessionDbType } from '../types/session-db.type';
import { UpdateSessionTimestamps } from '../aplication/types/update-session-timestamps.type';

@Injectable()
export class SessionsRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async insertSession(dto: CreateSessionDomainDto): Promise<number> {
    const queryResult: QueryResult<{ id: number }> = await this.pool.query<{
      id: number;
    }>(
      `
        INSERT INTO "Sessions" ("userId", "deviceId", "deviceName", "ip", "iat", "exp")
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING id;
      `,
      [dto.userId, dto.deviceId, dto.deviceName, dto.ip, dto.iat, dto.exp],
    );

    return queryResult.rows[0].id;
  }

  // async getAllSessionsExceptCurrent(
  //   userId: string,
  //   deviceId: string,
  // ): Promise<SessionDocument[]> {
  //   return this.SessionModel.find({
  //     userId,
  //     deviceId: { $ne: deviceId },
  //     deletedAt: null,
  //   });
  // }
  //
  async getByDeviceId(deviceId: string): Promise<SessionDbType | null> {
    const queryResult: QueryResult<SessionDbType> =
      await this.pool.query<SessionDbType>(
        `SELECT *
         FROM "Sessions"
         WHERE "deviceId" = $1`,
        [deviceId],
      );

    if (queryResult.rowCount === 0) {
      return null;
    }

    return queryResult.rows[0];
  }

  async updateTimestamps(dto: UpdateSessionTimestamps): Promise<void> {
    const { sessionId, iat, exp } = dto;

    await this.pool.query(
      `UPDATE "Sessions"
       SET iat = $1,
           exp = $2
       WHERE "id" = $3`,
      [iat, exp, sessionId],
    );
  }

  //TODO: как лучше удалять сессию (так как у меня или использовать softDelete)?

  async deleteSessionById(id: number): Promise<void> {
    await this.pool.query(
      `DELETE
       FROM "Sessions"
       WHERE id = $1`,
      [id],
    );
  }
}
