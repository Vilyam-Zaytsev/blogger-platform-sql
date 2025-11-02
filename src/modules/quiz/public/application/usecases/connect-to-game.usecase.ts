import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { GamesRepository } from '../../infrastructure/games.repository';
import { Game } from '../../domain/entities/game.entity';
import { GameRole, Player } from '../../domain/entities/player.entity';
import { PlayersRepository } from '../../infrastructure/players.repository';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';
import { QuestionsRepository } from '../../../admin/infrastructure/questions-repository';
import { Question } from '../../../admin/domain/entities/question.entity';
import { GameQuestionCreateDto } from '../../domain/dto/game-question.create-dto';
import { GameQuestion } from '../../domain/entities/game-question.entity';

export class ConnectToGameCommand {
  constructor(public readonly userId: number) {}
}

@CommandHandler(ConnectToGameCommand)
export class ConnectToGameUseCase implements ICommandHandler<ConnectToGameCommand> {
  constructor(
    private readonly gamesRepository: GamesRepository,
    private readonly playersRepository: PlayersRepository,
    private readonly questionsRepository: QuestionsRepository,
  ) {}

  async execute({ userId }: ConnectToGameCommand): Promise<number> {
    const player: Player | null =
      await this.playersRepository.getPlayerByUserIdInPendingOrActiveGame(userId);

    if (player) {
      throw new DomainException({
        code: DomainExceptionCode.Forbidden,
        message: `User with id ${userId} is already participating in active pair`,
      });
    }

    let gameId: number | null = (await this.gamesRepository.getGameInPending())?.id ?? null;

    if (!gameId) {
      const game: Game = Game.create();
      gameId = await this.gamesRepository.save(game);

      const newPlayer: Player = Player.create(userId, gameId);
      newPlayer.updateRole(GameRole.Host);
      await this.playersRepository.save(newPlayer);

      return gameId;
    }

    const newPlayer: Player = Player.create(userId, gameId);
    await this.playersRepository.save(newPlayer);

    const questions: Question[] = await this.questionsRepository.getRandomPublishedQuestions(5);

    if (questions.length < 5) {
      throw new DomainException({
        code: DomainExceptionCode.InternalServerError,
        message: `Insufficient published questions for game creation. Required: ${5}, available: ${questions.length}`,
      });
    }

    const promisesCreatedGameQuestions: Promise<number>[] = [];

    for (let i = 0; i < 5; i++) {
      const dto: GameQuestionCreateDto = {
        order: i + 1,
        gameId,
        questionId: questions[i].id,
      };

      const gameQuestion: GameQuestion = GameQuestion.create(dto);
      const promise: Promise<number> = this.gamesRepository.saveGameQuestion(gameQuestion);

      promisesCreatedGameQuestions.push(promise);
    }

    await Promise.all(promisesCreatedGameQuestions);

    const game: Game | null = await this.gamesRepository.getById(gameId);

    if (!game) {
      throw new DomainException({
        code: DomainExceptionCode.InternalServerError,
        message: `Unable to connect to game with ID ${gameId}. Game not found or no longer available`,
      });
    }

    game.startGame();

    return this.gamesRepository.save(game);
  }
}
