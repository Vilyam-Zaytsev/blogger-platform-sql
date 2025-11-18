import { Injectable } from '@nestjs/common';
import { GamesRepository } from '../../infrastructure/games.repository';
import {
  DetailsOfQuestion,
  GameProgress,
  PlayerProgress,
} from '../../infrastructure/types/game-progress.type';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';
import { AnswerStatus } from '../entities/answer.entity';
import { Player } from '../entities/player.entity';
import { PlayersRepository } from '../../infrastructure/players.repository';
import { PlayerInfoService } from './player-info.service';
import { REQUIRED_QUESTIONS_COUNT } from '../constants/game.constants';
import { AwardPointsDto } from '../dto/award-points.dto';

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

  getCurrentQuestionOrFailed(
    progressCurrentPlayer: PlayerProgress,
    questions: DetailsOfQuestion[],
  ): DetailsOfQuestion {
    if (!(progressCurrentPlayer.answersCount < REQUIRED_QUESTIONS_COUNT)) {
      throw new DomainException({
        code: DomainExceptionCode.Forbidden,
        message: `The player ${progressCurrentPlayer.playerId} has already answered all the questions`,
      });
    }

    return questions[progressCurrentPlayer.answersCount];
  }

  determineAnswerStatus(userAnswer: string, correctAnswers: string[]): AnswerStatus {
    return correctAnswers.includes(userAnswer) ? AnswerStatus.Correct : AnswerStatus.Incorrect;
  }

  async awardPointsToPlayer({
    playerId,
    answerStatus,
    questionOrder,
    opponentAnswersCount,
  }: AwardPointsDto): Promise<void> {
    if (answerStatus === AnswerStatus.Incorrect && questionOrder < REQUIRED_QUESTIONS_COUNT) return;

    const player: Player = await this.playerInfoService.findPlayerOrFailed(playerId);

    if (answerStatus === AnswerStatus.Incorrect && questionOrder === REQUIRED_QUESTIONS_COUNT) {
      if (player.score > 0 && opponentAnswersCount < REQUIRED_QUESTIONS_COUNT) {
        player.addScore();
        await this.playersRepository.save(player);

        return;
      } else {
        return;
      }
    }

    if (answerStatus === AnswerStatus.Correct && questionOrder < REQUIRED_QUESTIONS_COUNT) {
      player.addScore();
      await this.playersRepository.save(player);

      return;
    }

    if (answerStatus === AnswerStatus.Correct && questionOrder === REQUIRED_QUESTIONS_COUNT) {
      if (opponentAnswersCount < REQUIRED_QUESTIONS_COUNT) {
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
