import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../../../core/repositories/base.repository';
import { DataSource } from 'typeorm';
import { Game } from '../domain/entities/game.entity';

@Injectable()
export class GamesRepository extends BaseRepository<Game> {
  constructor(dataSource: DataSource) {
    super(dataSource, Game);
  }
}
