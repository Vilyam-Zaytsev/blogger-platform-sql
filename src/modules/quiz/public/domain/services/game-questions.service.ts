import { Injectable } from '@nestjs/common';
import { QuestionsRepository } from '../../../admin/infrastructure/questions-repository';
import { GamesRepository } from '../../infrastructure/games.repository';
import { Question } from '../../../admin/domain/entities/question.entity';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';
import { GameQuestion } from '../entities/game-question.entity';
import { GameQuestionCreateDto } from '../dto/game-question.create-dto';
import { REQUIRED_QUESTIONS_COUNT } from '../constants/game.constants';

@Injectable()
export class GameQuestionsService {
  constructor(
    private readonly questionsRepository: QuestionsRepository,
    private readonly gamesRepository: GamesRepository,
  ) {}

  async assignRandomQuestionsToGame(gameId: number): Promise<void> {
    const questions: Question[] =
      await this.questionsRepository.getRandomPublishedQuestions(REQUIRED_QUESTIONS_COUNT);

    this.validateSufficientQuestions(questions);

    const gameQuestions: GameQuestion[] = this.createGameQuestions(gameId, questions);
    await this.saveGameQuestions(gameQuestions);
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

  private async saveGameQuestions(gameQuestions: GameQuestion[]): Promise<void> {
    const savePromises: Promise<number>[] = gameQuestions.map((gq) =>
      this.gamesRepository.saveGameQuestion(gq),
    );

    await Promise.all(savePromises);
  }
}
