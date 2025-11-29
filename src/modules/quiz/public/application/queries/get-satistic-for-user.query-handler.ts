import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { StatisticViewDto } from '../../api/view-dto/statistic.view-dto';
import { GamesQueryRepository } from '../../infrastructure/query/games.query-repository';

export class GetMyStatisticQuery {
  constructor(public userId: number) {}
}

@QueryHandler(GetMyStatisticQuery)
export class GetMyStatisticQueryHandler
  implements IQueryHandler<GetMyStatisticQuery, StatisticViewDto>
{
  constructor(private readonly gamesQueryRepository: GamesQueryRepository) {}

  async execute({ userId }: GetMyStatisticQuery): Promise<StatisticViewDto> {
    return this.gamesQueryRepository.getMyStatisticByUserId(userId);
  }
}
