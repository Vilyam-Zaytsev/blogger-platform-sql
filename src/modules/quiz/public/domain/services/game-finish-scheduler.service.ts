import { Injectable, Logger } from '@nestjs/common';
import { GamesRepository } from '../../infrastructure/games.repository';
import { PlayersRepository } from '../../infrastructure/players.repository';
import { Game, GameStatus } from '../entities/game.entity';
import { Answer, AnswerStatus } from '../entities/answer.entity';
import { REQUIRED_QUESTIONS_COUNT } from '../constants/game.constants';
import {
  DetailsOfQuestion,
  GameProgress,
  PlayerProgress,
} from '../../infrastructure/types/game-progress.type';
import { Player } from '../entities/player.entity';

export interface GameFinishScheduleData {
  gameId: number;
  userId: number;
  firstFinishedPlayerId: number;
}

@Injectable()
export class GameFinishSchedulerService {
  private readonly logger: Logger = new Logger(GameFinishSchedulerService.name);
  private readonly TIMEOUT_MS: number = 10 * 1000;
  private readonly scheduledGames = new Map<number, NodeJS.Timeout>();

  constructor(
    private readonly gamesRepository: GamesRepository,
    private readonly playersRepository: PlayersRepository,
  ) {}

  public async scheduleGameFinish(data: GameFinishScheduleData): Promise<void> {
    const { gameId } = data;

    if (this.scheduledGames.has(gameId)) {
      this.logger.warn(`Game ${gameId} already has scheduled finish. Skipping.`);
      return;
    }

    this.logger.log(
      `Scheduling game finish for gameId=${gameId}. Timeout: ${this.TIMEOUT_MS / 1000}s. `,
    );

    const timeoutId = setTimeout(async () => {
      try {
        await this.handleGameFinish(data);
        this.scheduledGames.delete(gameId);
      } catch (error) {
        this.logger.error(`Error finishing game ${gameId}: ${error.message}`, error.stack);
      }
    }, this.TIMEOUT_MS);

    this.scheduledGames.set(gameId, timeoutId);

    this.logger.log(
      `Game ${gameId} scheduled. Will finish at: ` +
        `${new Date(Date.now() + this.TIMEOUT_MS).toISOString()}`,
    );
  }

  public cancelGameFinish(gameId: number): void {
    const timeoutId = this.scheduledGames.get(gameId);

    if (!timeoutId) {
      this.logger.warn(`No scheduled finish found for game ${gameId}`);
      return;
    }

    clearTimeout(timeoutId);

    this.scheduledGames.delete(gameId);

    this.logger.log(
      `Game finish cancelled for game ${gameId}. ` + `Second player answered in time!`,
    );
  }

  public clearAll(): void {
    this.logger.log(`Clearing ${this.scheduledGames.size} scheduled games`);

    for (const [gameId, timeoutId] of this.scheduledGames.entries()) {
      clearTimeout(timeoutId);
    }

    this.scheduledGames.clear();

    this.logger.log(`All scheduled games cleared`);
  }

  public getScheduledGames() {
    return this.scheduledGames;
  }

  private async handleGameFinish(data: GameFinishScheduleData): Promise<void> {
    const { gameId, userId, firstFinishedPlayerId } = data;

    this.logger.log(`[SCHEDULER HANDLER START] Processing game ${gameId}`);

    const game: Game | null = await this.gamesRepository.getById(gameId);

    if (!game) {
      this.logger.warn(`Game ${gameId} not found. Skipping.`);
      return;
    }

    if (game.status === GameStatus.Finished) {
      this.logger.log(`Game ${gameId} already finished. Second player answered in time.`);
      return;
    }

    if (game.status !== GameStatus.Active) {
      this.logger.warn(`Game ${gameId} has unexpected status: ${game.status}`);
      return;
    }

    const gameProgress: GameProgress | null =
      await this.gamesRepository.getGameProgressByUserId(userId);

    if (!gameProgress) {
      this.logger.error(`GameProgress not found for gameId=${gameId}, userId=${userId}`);
      throw new Error(`GameProgress not found for gameId=${gameId}`);
    }

    const firstPlayer: PlayerProgress =
      gameProgress.progressCurrentPlayer.playerId === firstFinishedPlayerId
        ? gameProgress.progressCurrentPlayer
        : gameProgress.progressOpponent;

    const secondPlayer: PlayerProgress =
      gameProgress.progressCurrentPlayer.playerId === firstFinishedPlayerId
        ? gameProgress.progressOpponent
        : gameProgress.progressCurrentPlayer;

    if (secondPlayer.answers.length === REQUIRED_QUESTIONS_COUNT) {
      this.logger.log(`Second player already answered all questions. Nothing to do.`);
      return;
    }

    const unansweredQuestions: DetailsOfQuestion[] = gameProgress.questions.filter(
      (q, index) => index >= secondPlayer.answers.length,
    );

    const incorrectAnswersPromises: Promise<Answer>[] = unansweredQuestions.map((question) => {
      const answer: Answer = Answer.create({
        answerBody: '',
        status: AnswerStatus.Incorrect,
        playerId: secondPlayer.playerId,
        gameQuestionId: question.gameQuestionId,
        gameId,
      });

      return this.gamesRepository.saveAnswer(answer);
    });

    await Promise.all(incorrectAnswersPromises);

    if (firstPlayer.score > 0) {
      const firstPlayerEntity: Player | null = await this.playersRepository.getById(
        firstPlayer.playerId,
      );

      if (firstPlayerEntity) {
        firstPlayerEntity.addScore();
        await this.playersRepository.save(firstPlayerEntity);
      }
    }

    game.finishGame();
    await this.gamesRepository.save(game);

    this.logger.log(`[SCHEDULER HANDLER END] Game ${gameId} finished successfully`);
  }
}
