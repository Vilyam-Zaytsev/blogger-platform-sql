export class AnswerViewDto {
  questionId: string;
  answerStatus: AnswerStatus;
  addedAt: string;
}

//TODO: вынести в сущность Answer
export enum AnswerStatus {
  Correct = 'Correct',
  Incorrect = 'Incorrect',
}
