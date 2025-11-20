import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GameViewDto } from '../../api/view-dto/game.view-dto';
import { GamesQueryRepository } from '../../infrastructure/query/games.query-repository';
import { PlayerValidationService } from '../../domain/services/player-validation.service';
import { TypeId } from '../../../types/type-id.type';

export class GetGameQuery {
  constructor(
    public readonly userId: number,
    public readonly gameId: string,
  ) {}
}

@QueryHandler(GetGameQuery)
export class GetGameQueryHandler implements IQueryHandler<GetGameQuery, GameViewDto> {
  constructor(
    private readonly gameQueryRepository: GamesQueryRepository,
    private readonly playerValidationService: PlayerValidationService,
  ) {}

  async execute({ gameId, userId }: GetGameQuery): Promise<GameViewDto> {
    const game: GameViewDto = await this.gameQueryRepository.getByIdOrNotFoundFail(
      gameId,
      TypeId.publicId,
    );

    this.playerValidationService.ensureUserParticipatesInCurrentGame(userId, game);

    return game;
  }
}
