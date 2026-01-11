import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../../../core/repositories/base.repository';
import { Player } from '../domain/entities/player.entity';
import { In } from 'typeorm';
import { GameStatus } from '../domain/entities/game.entity';
import { TransactionHelper } from '../../../../trasaction.helper';

@Injectable()
export class PlayersRepository extends BaseRepository<Player> {
  constructor(protected readonly transactionHelper: TransactionHelper) {
    super(Player, transactionHelper);
  }

  async getByIdWithLock(id: number): Promise<Player | null> {
    return await this.getRepository()
      .createQueryBuilder('p')
      .where('p.id = :id', { id })
      .setLock('pessimistic_write')
      .getOne();
  }

  async getPlayerByUserIdInPendingOrActiveGame(userId: number): Promise<Player | null> {
    return await this.getRepository().findOne({
      where: {
        userId,
        game: {
          status: In([GameStatus.Pending, GameStatus.Active]),
        },
      },
    });
  }

  async getPlayerByUserIdInActiveGame(userId: number): Promise<Player | null> {
    return await this.getRepository().findOne({
      where: {
        userId,
        game: {
          status: GameStatus.Active,
        },
      },
    });
  }
}
