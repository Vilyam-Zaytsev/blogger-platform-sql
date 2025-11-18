import { AnswerStatus } from '../entities/answer.entity';

export class AwardPointsDto {
  playerId: number;
  answerStatus: AnswerStatus;
  questionOrder: number;
  opponentAnswersCount: number;
}
