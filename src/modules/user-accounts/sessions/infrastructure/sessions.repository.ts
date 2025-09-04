import { Inject, Injectable } from '@nestjs/common';
import { PG_POOL } from '../../../database/constants/database.constants';
import { Pool } from 'pg';
import { SessionContextDto } from '../../auth/domain/guards/dto/session-context.dto';
import { Session } from '../domain/entities/session.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';

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

  async softDeleteAllSessionsExceptCurrent(dto: SessionContextDto): Promise<void> {
    await this.sessions.softDelete({
      userId: dto.userId,
      deviceId: Not(dto.deviceId),
    });
  }

  async getByDeviceId(deviceId: string): Promise<Session | null> {
    return await this.sessions.findOneBy({ deviceId });
  }
}
