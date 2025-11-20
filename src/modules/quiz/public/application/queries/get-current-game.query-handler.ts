import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GameViewDto } from '../../api/view-dto/game.view-dto';
import { PlayerValidationService } from '../../domain/services/player-validation.service';
import { GamesQueryRepository } from '../../infrastructure/query/games.query-repository';
import { TypeId } from '../../../types/type-id.type';

export class GetCurrentGameQuery {
  constructor(public readonly userId: number) {}
}

@QueryHandler(GetCurrentGameQuery)
export class GetCurrentGameQueryHandler implements IQueryHandler<GetCurrentGameQuery, GameViewDto> {
  constructor(
    private readonly gamesQueryRepository: GamesQueryRepository,
    private readonly playersValidationService: PlayerValidationService,
  ) {}

  async execute({ userId }: GetCurrentGameQuery): Promise<GameViewDto> {
    const gameId: number =
      await this.playersValidationService.ensureUserInPendingOrActiveGame(userId);

    return this.gamesQueryRepository.getByIdOrNotFoundFail(gameId, TypeId.id);
  }
}
