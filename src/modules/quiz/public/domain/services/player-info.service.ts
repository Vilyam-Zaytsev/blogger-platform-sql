import { PlayersRepository } from '../../infrastructure/players.repository';
import { Player } from '../entities/player.entity';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';
import { Injectable } from '@nestjs/common';

@Injectable()
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
}
