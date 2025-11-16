import { PlayersRepository } from '../../infrastructure/players.repository';
import { GameRole, Player } from '../entities/player.entity';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';
import { PlayerProgress } from '../../infrastructure/types/player-progress.type';

export class PlayerInfoService {
  constructor(private readonly playersRepository: PlayersRepository) {}

  async findPlayerOrFailed(playerId: number): Promise<Player> {
    const player: Player | null = await this.playersRepository.getById(playerId);

    if (!player) {
      throw new DomainException({
        code: DomainExceptionCode.InternalServerError,
        message: `Data discrepancy: The player ${playerId} passed an active game check, but no player data was found`,
      });
    }

    return player;
  }

  async findOpponentProgress(gameId: number, opponentRole: GameRole): Promise<PlayerProgress> {
    const opponentProgress: PlayerProgress | null = await this.playersRepository.getPlayerProgress(
      gameId,
      opponentRole,
    );

    if (!opponentProgress) {
      throw new DomainException({
        code: DomainExceptionCode.InternalServerError,
        message: `Data mismatch: Player data has not been found`,
      });
    }

    return opponentProgress;
  }
}
