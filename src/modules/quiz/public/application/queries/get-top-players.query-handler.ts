import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PaginatedViewDto } from '../../../../../core/dto/paginated.view-dto';
import { TopGamePlayerViewDto } from '../../api/view-dto/top-game-player-view.dto';
import { GamesQueryRepository } from '../../infrastructure/query/games.query-repository';
import { GetTopPlayersQueryParams } from '../../api/input-dto/get-top-players-query-params.input-dto';

export class GetTopPlayersQuery {
  constructor(public readonly queryParams: GetTopPlayersQueryParams) {}
}

@QueryHandler(GetTopPlayersQuery)
export class GetTopPlayersQueryHandler
  implements IQueryHandler<GetTopPlayersQuery, PaginatedViewDto<TopGamePlayerViewDto>>
{
  constructor(private readonly gamesQueryRepository: GamesQueryRepository) {}

  async execute({
    queryParams,
  }: GetTopPlayersQuery): Promise<PaginatedViewDto<TopGamePlayerViewDto>> {
    return this.gamesQueryRepository.getTopPlayers(queryParams);
  }
}
