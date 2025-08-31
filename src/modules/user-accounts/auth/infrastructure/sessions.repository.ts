import { Inject, Injectable } from '@nestjs/common';
import { PG_POOL } from '../../../database/constants/database.constants';
import { Pool } from 'pg';
import { UpdateSessionTimestamps } from '../aplication/types/update-session-timestamps.type';
import { SessionContextDto } from '../domain/guards/dto/session-context.dto';
import { Session } from '../domain/entities/session.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class SessionsRepository {
  constructor(
    @InjectRepository(Session) private readonly sessions: Repository<Session>,
    @Inject(PG_POOL) private readonly pool: Pool,
  ) {}

  async save(session: Session): Promise<number> {
    const { id } = await this.sessions.save(session);

    return id;
  }

  async softDeleteCurrentSession(id: number): Promise<void> {
    await this.sessions.softDelete(id);
  }

  async getByDeviceId(deviceId: string): Promise<Session | null> {
    return await this.sessions.findOneBy({ deviceId });
  }

  async updateTimestamps(dto: UpdateSessionTimestamps): Promise<void> {
    const { sessionId, iat, exp } = dto;

    await this.pool.query(
      `UPDATE "Sessions"
       SET iat = $1,
           exp = $2
       WHERE "id" = $3
         AND "deletedAt" IS NULL`,
      [iat, exp, sessionId],
    );
  }

  async softDeleteAllSessionsExceptCurrent(dto: SessionContextDto): Promise<void> {
    await this.pool.query(
      `UPDATE "Sessions"
       SET "deletedAt" = NOW()
       WHERE "userId" = $1
         AND "deviceId" <> $2
         AND "deletedAt" IS NULL`,
      [dto.userId, dto.deviceId],
    );
  }
}
