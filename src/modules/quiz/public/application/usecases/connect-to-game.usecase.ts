import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Game } from '../../domain/entities/game.entity';
import { GameRole, Player } from '../../domain/entities/player.entity';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';
import { PlayersRepository } from '../../infrastructure/players.repository';
import { GamesRepository } from '../../infrastructure/games.repository';
import { Question } from '../../../admin/domain/entities/question.entity';
import { REQUIRED_QUESTIONS_COUNT } from '../../domain/constants/game.constants';
import { GameQuestion } from '../../domain/entities/game-question.entity';
import { QuestionsRepository } from '../../../admin/infrastructure/questions-repository';
import { GameQuestionCreateDto } from '../../domain/dto/game-question.create-dto';
import { TransactionHelper } from '../../../../../trasaction.helper';

export class ConnectToGameCommand {
  constructor(public readonly userId: number) {}
}

@CommandHandler(ConnectToGameCommand)
export class ConnectToGameUseCase implements ICommandHandler<ConnectToGameCommand> {
  constructor(
    private readonly playersRepository: PlayersRepository,
    private readonly gamesRepository: GamesRepository,
    private readonly questionsRepository: QuestionsRepository,
    private readonly transactionHelper: TransactionHelper,
  ) {}

  async execute({ userId }: ConnectToGameCommand): Promise<number> {
    return this.transactionHelper.doTransactional(async () => {
      await this.ensureUserNotInPendingOrActiveGame(userId);

      const pendingGame: Game | null = await this.gamesRepository.getGameInPendingWithLock();

      if (!pendingGame) {
        return this.createNewGameForPlayer(userId);
      }

      await this.assignRandomQuestionsToGame(pendingGame.id);
      await this.connectPlayerToGame(userId, pendingGame.id);

      return await this.startGame(pendingGame);
    });
  }

  async connectPlayerToGame(userId: number, gameId: number): Promise<void> {
    const newPlayer: Player = Player.create(userId, gameId);
    await this.playersRepository.save(newPlayer);
  }

  async startGame(game: Game): Promise<number> {
    game.startGame();

    return this.gamesRepository.save(game);
  }

  private async ensureUserNotInPendingOrActiveGame(userId: number): Promise<void> {
    const player: Player | null =
      await this.playersRepository.getPlayerByUserIdInPendingOrActiveGame(userId);

    if (player) {
      throw new DomainException({
        code: DomainExceptionCode.Forbidden,
        message: `User with id ${userId} is already participating in active pair`,
      });
    }
  }

  private async createNewGameForPlayer(userId: number): Promise<number> {
    const newGame: Game = Game.create();
    const gameId: number = await this.gamesRepository.save(newGame);

    const hostPlayer: Player = Player.create(userId, gameId);
    hostPlayer.updateRole(GameRole.Host);
    await this.playersRepository.save(hostPlayer);

    return gameId;
  }

  private async assignRandomQuestionsToGame(gameId: number): Promise<void> {
    const questions: Question[] =
      await this.questionsRepository.getRandomPublishedQuestions(REQUIRED_QUESTIONS_COUNT);

    this.validateSufficientQuestions(questions);

    const gameQuestions: GameQuestion[] = this.createGameQuestions(gameId, questions);

    const savePromises: Promise<number>[] = gameQuestions.map((gq) =>
      this.gamesRepository.saveGameQuestion(gq),
    );

    await Promise.all(savePromises);
  }

  private validateSufficientQuestions(questions: Question[]): void {
    if (questions.length < REQUIRED_QUESTIONS_COUNT) {
      throw new DomainException({
        code: DomainExceptionCode.InternalServerError,
        message: `Insufficient published questions for game creation. Required: ${REQUIRED_QUESTIONS_COUNT}, available: ${questions.length}`,
      });
    }
  }

  private createGameQuestions(gameId: number, questions: Question[]): GameQuestion[] {
    return questions.map((q, i) => {
      const dto: GameQuestionCreateDto = {
        order: i + 1,
        gameId,
        questionId: q.id,
      };

      return GameQuestion.create(dto);
    });
  }
}
