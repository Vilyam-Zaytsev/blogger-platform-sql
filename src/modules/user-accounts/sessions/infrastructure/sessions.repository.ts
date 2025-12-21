import { Injectable } from '@nestjs/common';
import { SessionContextDto } from '../../auth/domain/guards/dto/session-context.dto';
import { Session } from '../domain/entities/session.entity';
import { Not } from 'typeorm';
import { BaseRepository } from '../../../../core/repositories/base.repository';
import { TransactionHelper } from '../../../database/trasaction.helper';

@Injectable()
export class SessionsRepository extends BaseRepository<Session> {
  constructor(protected readonly transactionHelper: TransactionHelper) {
    super(Session, transactionHelper);
  }

  async softDeleteCurrentSession(id: number): Promise<void> {
    await super.softDelete(id);
  }

  async softDeleteAllSessionsExceptCurrent(dto: SessionContextDto): Promise<void> {
    await this.getRepository().softDelete({
      userId: dto.userId,
      deviceId: Not(dto.deviceId),
    });
  }

  async hardDeleteOldSoftDeletedSessions(daysOld: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await this.getRepository()
      .createQueryBuilder()
      .delete()
      .from(Session)
      .where('deleted_at IS NOT NULL')
      .andWhere('deleted_at < :cutoffDate', { cutoffDate })
      .execute();

    return result.affected || 0;
  }

  async getByDeviceId(deviceId: string): Promise<Session | null> {
    return await this.getRepository().findOneBy({ deviceId });
  }
}
