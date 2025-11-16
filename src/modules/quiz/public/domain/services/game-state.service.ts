import { Injectable } from '@nestjs/common';
import { GamesRepository } from '../../infrastructure/games.repository';
import { Game } from '../entities/game.entity';

@Injectable()
export class GameStateService {
  constructor(private readonly gamesRepository: GamesRepository) {}

  async startGame(game: Game): Promise<number> {
    game.startGame();

    return this.gamesRepository.save(game);
  }

  async finishGame(game: Game): Promise<number> {
    game.finishGame();

    return this.gamesRepository.save(game);
  }
}
