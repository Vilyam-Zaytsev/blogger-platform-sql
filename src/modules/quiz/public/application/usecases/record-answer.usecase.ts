import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PlayerValidationService } from '../../domain/services/player-validation.service';
import { GamesRepository } from '../../infrastructure/games.repository';
import { DetailsOfQuestion, GameProgress } from '../../infrastructure/types/game-progress.type';
import { Answer, AnswerStatus } from '../../domain/entities/answer.entity';
import { AnswerViewDto } from '../../api/view-dto/answer.view-dto';
import { GameProgressService } from '../../domain/services/game-progress.service';
import { GameStateService } from '../../domain/services/game-state.service';
import { Game } from '../../domain/entities/game.entity';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';

export class RecordAnswerCommand {
  constructor(
    public readonly userId: number,
    public readonly answerText: string,
  ) {}
}

@CommandHandler(RecordAnswerCommand)
export class RecordAnswerUseCase implements ICommandHandler<RecordAnswerCommand> {
  constructor(
    private readonly playerValidationService: PlayerValidationService,
    private readonly gameProgressService: GameProgressService,
    private readonly gameStateService: GameStateService,
    private readonly gamesRepository: GamesRepository,
  ) {}

  async execute({ userId, answerText }: RecordAnswerCommand): Promise<AnswerViewDto> {
    await this.playerValidationService.ensureUserInActiveGame(userId);

    const gameProgress: GameProgress =
      await this.gameProgressService.findGameProgressOrFailed(userId);

    const currentQuestion: DetailsOfQuestion =
      this.gameProgressService.getCurrentQuestionOrFailed(gameProgress);

    const answerStatus: AnswerStatus = this.gameProgressService.determineAnswerStatus(
      answerText,
      currentQuestion.correctAnswers,
    );

    const answer: Answer = Answer.create({
      answerBody: answerText,
      status: answerStatus,
      playerId: gameProgress.playerId,
      gameQuestionId: currentQuestion.gameQuestionId,
      gameId: gameProgress.gameId,
    });

    const savedAnswer: Answer = await this.gamesRepository.saveAnswer(answer);

    await this.gameProgressService.awardPointsToPlayer(
      gameProgress.playerId,
      answerStatus,
      currentQuestion.order,
      gameProgress.gameId,
    );

    if (currentQuestion.order === 5) {
      const game: Game | null = await this.gamesRepository.getById(gameProgress.gameId);

      if (!game) {
        throw new DomainException({
          code: DomainExceptionCode.InternalServerError,
          message: `At the end of the game (${gameProgress.gameId}), no game data was found`,
        });
      }

      await this.gameStateService.finishGame(game);
    }

    return {
      questionId: currentQuestion.questionPublicId,
      answerStatus,
      addedAt: savedAnswer.addedAt.toISOString(),
    };
  }
}
