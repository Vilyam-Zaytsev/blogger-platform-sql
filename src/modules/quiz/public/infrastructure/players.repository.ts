import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../../../core/repositories/base.repository';
import { Player } from '../domain/entities/player.entity';
import { DataSource, In } from 'typeorm';
import { GameStatus } from '../domain/entities/game.entity';

@Injectable()
export class PlayersRepository extends BaseRepository<Player> {
  constructor(dataSource: DataSource) {
    super(dataSource, Player);
  }

  async getPlayerByUserIdInPendingOrActiveGame(userId: number): Promise<Player | null> {
    return await this.repository.findOne({
      where: {
        userId,
        game: {
          status: In([GameStatus.Pending, GameStatus.Active]),
        },
      },
    });
  }

  async getPlayerByUserIdInActiveGame(userId: number): Promise<Player | null> {
    return await this.repository.findOne({
      where: {
        userId,
        game: {
          status: GameStatus.Active,
        },
      },
    });
  }
}
