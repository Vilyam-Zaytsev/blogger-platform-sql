import { AnswerStatus } from '../entities/answer.entity';

export class AnswerCreateDto {
  answerBody: string;
  status: AnswerStatus;
  playerId: number;
  gameQuestionId: number;
  gameId: number;
}
