import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../../../core/repositories/base.repository';
import { GameRole, Player } from '../domain/entities/player.entity';
import { DataSource, In } from 'typeorm';
import { GameStatus } from '../domain/entities/game.entity';
import { PlayerProgress } from './types/player-progress.type';

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
      relations: {
        user: true,
        game: true,
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
      relations: {
        user: true,
        game: true,
      },
    });
  }

  async getPlayerProgress(gameId: number, role: GameRole): Promise<PlayerProgress | null> {
    const qb = this.repository
      .createQueryBuilder('p')
      .select('p.id', 'playerId')
      .addSelect('p.score', 'score')
      .addSelect('COUNT(a.id)', 'answersCount')
      .leftJoin('p.answers', 'a')
      .where('p.game_id = :gameId', { gameId })
      .andWhere('p.role = :role', { role })
      .groupBy('p.id, p.score');

    const playerProgress: PlayerProgress | null = (await qb.getRawOne()) ?? null;

    return playerProgress;
  }
}
