import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { SessionContextDto } from '../../../auth/domain/guards/dto/session-context.dto';
import { SessionViewDto } from '../../api/view-dto/session.view-dto';
import { SessionsQueryRepository } from '../../infrastructure/query/sessions.query-repository';

export class GetSessionsQuery {
  constructor(public readonly dto: SessionContextDto) {}
}

@QueryHandler(GetSessionsQuery)
export class GetSessionsQueryHandler
  implements IQueryHandler<GetSessionsQuery, SessionViewDto[]>
{
  constructor(
    private readonly sessionsQueryRepository: SessionsQueryRepository,
  ) {}

  async execute({ dto }: GetSessionsQuery): Promise<SessionViewDto[]> {
    return this.sessionsQueryRepository.getAllByUserId(dto.userId);
  }
}
