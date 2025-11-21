import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GameViewDto } from '../../api/view-dto/game.view-dto';
import { GamesQueryRepository } from '../../infrastructure/query/games.query-repository';
import { Player } from '../../domain/entities/player.entity';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';
import { PlayersRepository } from '../../infrastructure/players.repository';

export class GetCurrentGameQuery {
  constructor(public readonly userId: number) {}
}

@QueryHandler(GetCurrentGameQuery)
export class GetCurrentGameQueryHandler implements IQueryHandler<GetCurrentGameQuery, GameViewDto> {
  constructor(
    private readonly gamesQueryRepository: GamesQueryRepository,
    private readonly playersRepository: PlayersRepository,
  ) {}

  async execute({ userId }: GetCurrentGameQuery): Promise<GameViewDto> {
    const gameId: number = await this.ensureUserInPendingOrActiveGame(userId);

    return await this.gamesQueryRepository.getByIdOrNotFoundFail(gameId);
  }

  private async ensureUserInPendingOrActiveGame(userId: number): Promise<number> {
    const player: Player | null =
      await this.playersRepository.getPlayerByUserIdInPendingOrActiveGame(userId);

    if (!player) {
      throw new DomainException({
        code: DomainExceptionCode.NotFound,
        message: `User with id ${userId} is not participating in active pair`,
      });
    }

    return player.gameId;
  }
}
