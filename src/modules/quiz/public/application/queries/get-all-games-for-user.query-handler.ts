import { GetGamesQueryParams } from '../../api/input-dto/get-games-query-params.input-dto';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PaginatedViewDto } from '../../../../../core/dto/paginated.view-dto';
import { GameViewDto } from '../../api/view-dto/game.view-dto';
import { GamesQueryRepository } from '../../infrastructure/query/games.query-repository';

export class GetAllGamesForUserQuery {
  constructor(
    public readonly queryParams: GetGamesQueryParams,
    public readonly userId: number,
  ) {}
}

@QueryHandler(GetAllGamesForUserQuery)
export class GetAllGamesForUserQueryHandler
  implements IQueryHandler<GetAllGamesForUserQuery, PaginatedViewDto<GameViewDto>>
{
  constructor(private readonly gamesQueryRepository: GamesQueryRepository) {}

  async execute({
    queryParams,
    userId,
  }: GetAllGamesForUserQuery): Promise<PaginatedViewDto<GameViewDto>> {
    return this.gamesQueryRepository.getAllGamesForUser(queryParams, userId);
  }
}
