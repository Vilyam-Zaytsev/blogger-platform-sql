import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { QuestionsRepository } from '../../infrastructure/questions-repository';
import { Question } from '../../domain/entities/question.entity';
import { QuestionValidatorService } from '../../domain/services/question-validator.service';

export class RemovePublicationQuestionCommand {
  constructor(public readonly id: string) {}
}

@CommandHandler(RemovePublicationQuestionCommand)
export class RemovePublicationQuestionUseCase
  implements ICommandHandler<RemovePublicationQuestionCommand>
{
  constructor(
    private readonly questionsRepository: QuestionsRepository,
    private readonly questionValidator: QuestionValidatorService,
  ) {}

  async execute({ id }: RemovePublicationQuestionCommand): Promise<void> {
    const question: Question | null = await this.questionsRepository.getByPublicId(id);

    const validQuestion: Question = this.questionValidator.validateBeforeRemovePublication(
      question,
      id,
    );

    validQuestion.removePublication();
    await this.questionsRepository.save(validQuestion);
  }
}
