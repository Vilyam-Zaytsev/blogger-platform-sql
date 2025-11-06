import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Game } from '../../domain/entities/game.entity';
import { PlayerValidationService } from '../../domain/services/player-validation.service';
import { GameMatchingService } from '../../domain/services/game-matching.service';
import { GameQuestionsService } from '../../domain/services/game-questions.service';
import { GameStateService } from '../../domain/services/game-state.service';

export class ConnectToGameCommand {
  constructor(public readonly userId: number) {}
}

@CommandHandler(ConnectToGameCommand)
export class ConnectToGameUseCase implements ICommandHandler<ConnectToGameCommand> {
  constructor(
    private readonly playerValidationService: PlayerValidationService,
    private readonly gameMatchingService: GameMatchingService,
    private readonly gameQuestionsService: GameQuestionsService,
    private readonly gameStateService: GameStateService,
  ) {}

  async execute({ userId }: ConnectToGameCommand): Promise<number> {
    await this.playerValidationService.ensureUserNotInActiveGame(userId);

    const pendingGame: Game | null = await this.gameMatchingService.findPendingGame();

    if (!pendingGame) {
      return this.gameMatchingService.createNewGameForPlayer(userId);
    }

    await this.gameQuestionsService.assignRandomQuestionsToGame(pendingGame.id);

    await this.gameMatchingService.connectPlayerToGame(userId, pendingGame.id);

    return await this.gameStateService.startGame(pendingGame);
  }
}
