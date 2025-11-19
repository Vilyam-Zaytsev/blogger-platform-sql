import { Injectable } from '@nestjs/common';
import { PlayersRepository } from '../../infrastructure/players.repository';
import { Player } from '../entities/player.entity';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';
import { GameViewDto } from '../../api/view-dto/game.view-dto';

@Injectable()
export class PlayerValidationService {
  constructor(private readonly playersRepository: PlayersRepository) {}

  async ensureUserNotInPendingOrActiveGame(userId: number): Promise<void> {
    const player: Player | null =
      await this.playersRepository.getPlayerByUserIdInPendingOrActiveGame(userId);

    if (player) {
      throw new DomainException({
        code: DomainExceptionCode.Forbidden,
        message: `User with id ${userId} is already participating in active pair`,
      });
    }
  }

  async ensureUserInPendingOrActiveGame(userId: number): Promise<number> {
    const player: Player | null =
      await this.playersRepository.getPlayerByUserIdInPendingOrActiveGame(userId);

    if (!player) {
      throw new DomainException({
        code: DomainExceptionCode.NotFound,
        message: `User with id ${userId} is not participating in active pair`,
      });
    }

    return player.game.id;
  }

  async ensureUserInActiveGame(userId: number): Promise<void> {
    const player: Player | null =
      await this.playersRepository.getPlayerByUserIdInActiveGame(userId);

    if (!player) {
      throw new DomainException({
        code: DomainExceptionCode.Forbidden,
        message: `The user with the ID ${userId} is not in an active pair`,
      });
    }
  }

  ensureUserParticipatesInCurrentGame(userId: number, game: GameViewDto): void {
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
