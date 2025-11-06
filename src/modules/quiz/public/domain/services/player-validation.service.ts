import { Injectable } from '@nestjs/common';
import { PlayersRepository } from '../../infrastructure/players.repository';
import { Player } from '../entities/player.entity';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';

@Injectable()
export class PlayerValidationService {
  constructor(private readonly playersRepository: PlayersRepository) {}

  async ensureUserNotInActiveGame(userId: number): Promise<void> {
    const player: Player | null =
      await this.playersRepository.getPlayerByUserIdInPendingOrActiveGame(userId);

    if (player) {
      throw new DomainException({
        code: DomainExceptionCode.Forbidden,
        message: `User with id ${userId} is already participating in active pair`,
      });
    }
  }
}
