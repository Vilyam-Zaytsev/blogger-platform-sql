import { Injectable } from '@nestjs/common';
import { SessionViewDto } from '../../api/view-dto/session.view-dto';
import { Session } from '../../domain/entities/session.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class SessionsQueryRepository {
  constructor(@InjectRepository(Session) private readonly sessions: Repository<Session>) {}

  async getAllByUserId(userId: number): Promise<SessionViewDto[]> {
    const sessions: Session[] = await this.sessions.findBy({ userId });

    return sessions.map((s) => SessionViewDto.mapToView(s));
  }
}
