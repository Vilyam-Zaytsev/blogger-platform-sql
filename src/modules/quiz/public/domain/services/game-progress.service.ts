import { Injectable } from '@nestjs/common';
import { GamesRepository } from '../../infrastructure/games.repository';
import { DetailsOfQuestion, GameProgress } from '../../infrastructure/types/game-progress.type';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';
import { AnswerStatus } from '../entities/answer.entity';

@Injectable()
export class GameProgressService {
  constructor(private readonly gamesRepository: GamesRepository) {}

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
}
