import { Injectable } from '@nestjs/common';
import { GamesRepository } from '../../infrastructure/games.repository';
import { DetailsOfQuestion, GameProgress } from '../../infrastructure/types/game-progress.type';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';
import { AnswerStatus } from '../entities/answer.entity';
import { GameRole, Player } from '../entities/player.entity';
import { PlayersRepository } from '../../infrastructure/players.repository';
import { PlayerProgress } from '../../infrastructure/types/player-progress.type';
import { PlayerInfoService } from './player-info.service';

@Injectable()
export class GameProgressService {
  constructor(
    private readonly gamesRepository: GamesRepository,
    private readonly playersRepository: PlayersRepository,
    private readonly playerInfoService: PlayerInfoService,
  ) {}

  async findGameProgressOrFailed(userId: number): Promise<GameProgress> {
    const gameProgress: GameProgress | null =
      await this.gamesRepository.getGameProgressByUserId(userId);

    if (!gameProgress) {
      throw new DomainException({
        code: DomainExceptionCode.InternalServerError,
        message: `Data discrepancy: User ${userId} passed an active game check, but no game data was found`,
      });
    }

    return gameProgress;
  }

  getCurrentQuestionOrFailed({
    questionsCount,
    answersCount,
    questions,
  }: GameProgress): DetailsOfQuestion {
    if (!(answersCount < questionsCount)) {
      throw new DomainException({
        code: DomainExceptionCode.Forbidden,
        message: 'The player has already answered all the questions',
      });
    }

    return questions[answersCount];
  }

  determineAnswerStatus(userAnswer: string, correctAnswers: string[]): AnswerStatus {
    return correctAnswers.includes(userAnswer) ? AnswerStatus.Correct : AnswerStatus.Incorrect;
  }

  async awardPointsToPlayer(
    playerId: number,
    answerStatus: AnswerStatus,
    questionOrder: number,
    gameId: number,
  ): Promise<void> {
    if (answerStatus === AnswerStatus.Incorrect && questionOrder < 5) return;

    const player: Player = await this.playerInfoService.findPlayerOrFailed(playerId);

    const opponentRole: GameRole = player.role === GameRole.Host ? GameRole.Player : GameRole.Host;
    const opponentProgress: PlayerProgress = await this.playerInfoService.findOpponentProgress(
      gameId,
      opponentRole,
    );

    if (answerStatus === AnswerStatus.Incorrect && questionOrder === 5) {
      if (player.score > 0 && opponentProgress.answersCount < 5) {
        player.addScore();
        await this.playersRepository.save(player);

        return;
      } else {
        return;
      }
    }

    if (answerStatus === AnswerStatus.Correct && questionOrder < 5) {
      player.addScore();
      await this.playersRepository.save(player);

      return;
    }

    if (answerStatus === AnswerStatus.Correct && questionOrder === 5) {
      if (opponentProgress.answersCount < 5) {
        player.addScore(2);
        await this.playersRepository.save(player);

        return;
      } else {
        player.addScore();
        await this.playersRepository.save(player);

        return;
      }
    }
  }
}
