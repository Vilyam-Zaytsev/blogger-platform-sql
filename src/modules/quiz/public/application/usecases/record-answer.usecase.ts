import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { GamesRepository } from '../../infrastructure/games.repository';
import { DetailsOfQuestion, GameProgress } from '../../infrastructure/types/game-progress.type';
import { Answer, AnswerStatus } from '../../domain/entities/answer.entity';
import { AnswerViewDto } from '../../api/view-dto/answer.view-dto';
import { Game } from '../../domain/entities/game.entity';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';
import { REQUIRED_QUESTIONS_COUNT } from '../../domain/constants/game.constants';
import { Player } from '../../domain/entities/player.entity';
import { PlayersRepository } from '../../infrastructure/players.repository';
import { AnswerCreateDto } from '../../domain/dto/answer.create-dto';
import { GameFinishSchedulerService } from '../../domain/services/game-finish-scheduler.service';
import { TransactionHelper } from '../../../../database/trasaction.helper';

export class RecordAnswerCommand {
  constructor(
    public readonly userId: number,
    public readonly answerText: string,
  ) {}
}

@CommandHandler(RecordAnswerCommand)
export class RecordAnswerUseCase implements ICommandHandler<RecordAnswerCommand> {
  constructor(
    private readonly gameFinishScheduler: GameFinishSchedulerService,
    private readonly playersRepository: PlayersRepository,
    private readonly gamesRepository: GamesRepository,
    private readonly transactionHelper: TransactionHelper,
  ) {}

  async execute({ userId, answerText }: RecordAnswerCommand): Promise<AnswerViewDto> {
    return this.transactionHelper.doTransactional(async () => {
      await this.ensureUserInActiveGame(userId);

      const gameProgress: GameProgress = await this.findGameProgressOrFailed(userId);

      this.ensurePlayerHasUnansweredQuestions(gameProgress);

      const currentQuestion: DetailsOfQuestion =
        gameProgress.questions[gameProgress.progressCurrentPlayer.answers.length];

      const answerStatus: AnswerStatus = this.determineAnswerStatus(answerText, currentQuestion);

      const newAnswer: Answer = await this.createAnswer({
        answerBody: answerText,
        status: answerStatus,
        playerId: gameProgress.progressCurrentPlayer.playerId,
        gameQuestionId: currentQuestion.gameQuestionId,
        gameId: gameProgress.gameId,
      });

      await this.awardPointsToPlayer(gameProgress.progressCurrentPlayer.playerId, answerStatus);

      if (currentQuestion.order === REQUIRED_QUESTIONS_COUNT) {
        if (gameProgress.progressOpponent.answers.length === REQUIRED_QUESTIONS_COUNT) {
          this.gameFinishScheduler.cancelGameFinish(gameProgress.gameId);

          await this.awardBonusPointsToPlayer(userId);

          const game: Game | null = await this.gamesRepository.getByIdWithLock(gameProgress.gameId);

          if (!game) {
            throw new DomainException({
              code: DomainExceptionCode.InternalServerError,
              message: `At the end of the game (${gameProgress.gameId}), no game data was found`,
            });
          }

          await this.finishGame(game);
        } else {
          await this.gameFinishScheduler.scheduleGameFinish({
            gameId: gameProgress.gameId,
            userId,
            firstFinishedPlayerId: gameProgress.progressCurrentPlayer.playerId,
          });
        }
      }

      return {
        questionId: currentQuestion.questionPublicId,
        answerStatus,
        addedAt: newAnswer.addedAt.toISOString(),
      };
    });
  }

  private async ensureUserInActiveGame(userId: number): Promise<void> {
    const player: Player | null =
      await this.playersRepository.getPlayerByUserIdInActiveGame(userId);

    if (!player) {
      throw new DomainException({
        code: DomainExceptionCode.Forbidden,
        message: `The user with the ID ${userId} is not in an active pair`,
      });
    }
  }

  private ensurePlayerHasUnansweredQuestions(gameProgress: GameProgress) {
    const answersCount: number = gameProgress.progressCurrentPlayer.answers.length;

    if (!(answersCount < REQUIRED_QUESTIONS_COUNT)) {
      throw new DomainException({
        code: DomainExceptionCode.Forbidden,
        message: `The player ${gameProgress.progressCurrentPlayer.playerId} has already answered all the questions`,
      });
    }
  }

  private determineAnswerStatus(userAnswer: string, question: DetailsOfQuestion): AnswerStatus {
    return question.correctAnswers.includes(userAnswer)
      ? AnswerStatus.Correct
      : AnswerStatus.Incorrect;
  }

  private async createAnswer({
    answerBody,
    status,
    playerId,
    gameQuestionId,
    gameId,
  }: AnswerCreateDto): Promise<Answer> {
    const answer: Answer = Answer.create({
      answerBody,
      status,
      playerId,
      gameQuestionId,
      gameId,
    });

    return this.gamesRepository.saveAnswer(answer);
  }

  private async awardPointsToPlayer(playerId: number, answerStatus: AnswerStatus): Promise<void> {
    if (answerStatus === AnswerStatus.Incorrect) return;

    const player: Player = await this.findPlayerOrFailed(playerId);

    player.addScore();
    await this.playersRepository.save(player);

    return;
  }

  private async awardBonusPointsToPlayer(userId: number): Promise<void> {
    const gameProgress: GameProgress = await this.findGameProgressOrFailed(userId);

    const timeLastAnswerCurrentPlayer: number = new Date(
      gameProgress.progressCurrentPlayer.answers[REQUIRED_QUESTIONS_COUNT - 1].addedAt,
    ).getTime();
    const timeLastAnswerOpponent: number = new Date(
      gameProgress.progressOpponent.answers[REQUIRED_QUESTIONS_COUNT - 1].addedAt,
    ).getTime();

    if (timeLastAnswerCurrentPlayer < timeLastAnswerOpponent) {
      if (gameProgress.progressCurrentPlayer.score > 0) {
        const player: Player = await this.findPlayerOrFailed(
          gameProgress.progressCurrentPlayer.playerId,
        );

        player.addScore();
        await this.playersRepository.save(player);

        return;
      }
    } else {
      if (gameProgress.progressOpponent.score > 0) {
        const player: Player = await this.findPlayerOrFailed(
          gameProgress.progressOpponent.playerId,
        );

        player.addScore();
        await this.playersRepository.save(player);

        return;
      }
    }

    return;
  }

  private async findGameProgressOrFailed(userId: number): Promise<GameProgress> {
    const gameProgress: GameProgress | null =
      await this.gamesRepository.getGameProgressByUserIdWithLock(userId);

    if (!gameProgress) {
      throw new DomainException({
        code: DomainExceptionCode.InternalServerError,
        message: `Data discrepancy: User ${userId} passed an active game check, but no game data was found`,
      });
    }

    return gameProgress;
  }

  private async findPlayerOrFailed(id: number): Promise<Player> {
    const player: Player | null = await this.playersRepository.getByIdWithLock(id);

    if (!player) {
      throw new DomainException({
        code: DomainExceptionCode.InternalServerError,
        message: `Data discrepancy: The player ${id} passed an active game check, but no player data was found`,
      });
    }

    return player;
  }

  private async finishGame(game: Game): Promise<number> {
    game.finishGame();

    return this.gamesRepository.save(game);
  }
}
