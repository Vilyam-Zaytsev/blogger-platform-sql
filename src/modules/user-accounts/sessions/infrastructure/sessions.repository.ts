import { Injectable } from '@nestjs/common';
import { SessionContextDto } from '../../auth/domain/guards/dto/session-context.dto';
import { Session } from '../domain/entities/session.entity';
import { DataSource, Not } from 'typeorm';
import { BaseRepository } from '../../../../core/repositories/base.repository';
import { User } from '../../users/domain/entities/user.entity';

@Injectable()
export class SessionsRepository extends BaseRepository<Session> {
  constructor(dataSource: DataSource) {
    super(dataSource, User);
  }

  async softDeleteCurrentSession(id: number): Promise<void> {
    await super.softDelete(id);
  }

  async softDeleteAllSessionsExceptCurrent(dto: SessionContextDto): Promise<void> {
    await this.repository.softDelete({
      userId: dto.userId,
      deviceId: Not(dto.deviceId),
    });
  }

  async getByDeviceId(deviceId: string): Promise<Session | null> {
    return await this.repository.findOneBy({ deviceId });
  }
}
