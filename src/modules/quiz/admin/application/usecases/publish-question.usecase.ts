import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { QuestionsRepository } from '../../infrastructure/questions-repository';
import { Question } from '../../domain/entities/question.entity';
import { QuestionValidatorService } from '../../domain/services/question-validator.service';

export class PublishQuestionCommand {
  constructor(public readonly id: string) {}
}

@CommandHandler(PublishQuestionCommand)
export class PublishQuestionUseCase implements ICommandHandler<PublishQuestionCommand> {
  constructor(
    private readonly questionsRepository: QuestionsRepository,
    private readonly questionValidator: QuestionValidatorService,
  ) {}

  async execute({ id }: PublishQuestionCommand): Promise<void> {
    const question: Question | null = await this.questionsRepository.getByPublicId(id);

    const validQuestion: Question = this.questionValidator.validateBeforePublish(question, id);

    validQuestion.publish();
    await this.questionsRepository.save(validQuestion);
  }
}
