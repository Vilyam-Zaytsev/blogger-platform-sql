import { Injectable } from '@nestjs/common';
import { GamesRepository } from '../../infrastructure/games.repository';
import { PlayersRepository } from '../../infrastructure/players.repository';
import { Game } from '../entities/game.entity';
import { GameRole, Player } from '../entities/player.entity';

@Injectable()
export class GameMatchingService {
  constructor(
    private readonly gamesRepository: GamesRepository,
    private readonly playersRepository: PlayersRepository,
  ) {}

  async createNewGameForPlayer(userId: number): Promise<number> {
    const newGame: Game = Game.create();
    const gameId: number = await this.gamesRepository.save(newGame);

    const hostPlayer: Player = Player.create(userId, gameId);
    hostPlayer.updateRole(GameRole.Host);
    await this.playersRepository.save(hostPlayer);

    return gameId;
  }

  async connectPlayerToGame(userId: number, gameId: number): Promise<void> {
    const newPlayer: Player = Player.create(userId, gameId);
    await this.playersRepository.save(newPlayer);
  }

  async findPendingGame(): Promise<Game | null> {
    return this.gamesRepository.getGameInPending();
  }
}
