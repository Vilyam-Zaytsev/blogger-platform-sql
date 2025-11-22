import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GameViewDto } from '../../api/view-dto/game.view-dto';
import { GamesQueryRepository } from '../../infrastructure/query/games.query-repository';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';

export class GetGameQuery {
  constructor(
    public readonly userId: number,
    public readonly gameId: number,
  ) {}
}

@QueryHandler(GetGameQuery)
export class GetGameQueryHandler implements IQueryHandler<GetGameQuery, GameViewDto> {
  constructor(private readonly gameQueryRepository: GamesQueryRepository) {}

  async execute({ gameId, userId }: GetGameQuery): Promise<GameViewDto> {
    const game: GameViewDto = await this.gameQueryRepository.getByIdOrNotFoundFail(gameId);

    this.ensureUserParticipatesInCurrentGame(userId, game);

    return game;
  }

  private ensureUserParticipatesInCurrentGame(userId: number, game: GameViewDto): void {
    if (
      Number(game.firstPlayerProgress.player.id) !== userId &&
      Number(game.secondPlayerProgress?.player.id) !== userId
    ) {
      throw new DomainException({
        code: DomainExceptionCode.Forbidden,
        message: `User with id ${userId} is not a participant of game with id ${game.id}`,
      });
    }
  }
}
