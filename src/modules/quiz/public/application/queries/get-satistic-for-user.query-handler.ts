import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { StatisticViewDto } from '../../api/view-dto/statistic.view-dto';
import { GamesQueryRepository } from '../../infrastructure/query/games.query-repository';

export class GetStatisticForUserQuery {
  constructor(public userId: number) {}
}

@QueryHandler(GetStatisticForUserQuery)
export class GetStatisticForUserQueryHandler
  implements IQueryHandler<GetStatisticForUserQuery, StatisticViewDto>
{
  constructor(private readonly gamesQueryRepository: GamesQueryRepository) {}

  async execute({ userId }: GetStatisticForUserQuery): Promise<StatisticViewDto> {
    return this.gamesQueryRepository.getStatisticByUserId(userId);
  }
}
