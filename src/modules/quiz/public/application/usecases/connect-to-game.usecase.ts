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

  //TODO: обернуть в транзакцию

  async execute({ userId }: ConnectToGameCommand): Promise<number> {
    const player: Player | null =
      await this.playersRepository.getPlayerByUserIdInPendingOrActiveGame(userId);

    if (player) {
      throw new DomainException({
        code: DomainExceptionCode.Forbidden,
        message: `User with id ${userId} is already participating in active pair`,
      });
    }

    const game: Game | null = await this.gamesRepository.getGameInPending();

    if (!game) {
      const newGame: Game = Game.create();
      const idCreatedGame: number = await this.gamesRepository.save(newGame);

      const newPlayer: Player = Player.create(userId, idCreatedGame);
      newPlayer.updateRole(GameRole.Host);
      await this.playersRepository.save(newPlayer);

      return idCreatedGame;
    }

    const newPlayer: Player = Player.create(userId, game.id);
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
        gameId: game.id,
        questionId: questions[i].id,
      };

      const gameQuestion: GameQuestion = GameQuestion.create(dto);
      const promise: Promise<number> = this.gamesRepository.saveGameQuestion(gameQuestion);

      promisesCreatedGameQuestions.push(promise);
    }

    await Promise.all(promisesCreatedGameQuestions);

    game.startGame();

    return this.gamesRepository.save(game);
  }
}
