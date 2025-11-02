import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../../../core/repositories/base.repository';
import { DataSource } from 'typeorm';
import { Game, GameStatus } from '../domain/entities/game.entity';
import { GameQuestion } from '../domain/entities/game-question.entity';

@Injectable()
export class GamesRepository extends BaseRepository<Game> {
  constructor(dataSource: DataSource) {
    super(dataSource, Game);
  }

  async getGameInPending(): Promise<Game | null> {
    return await this.repository.findOne({ where: { status: GameStatus.Pending } });
  }

  async saveGameQuestion(gameQuestion: GameQuestion): Promise<number> {
    const { id }: GameQuestion = await this.dataSource
      .getRepository<GameQuestion>(GameQuestion)
      .save(gameQuestion);

    return id;
  }
}
