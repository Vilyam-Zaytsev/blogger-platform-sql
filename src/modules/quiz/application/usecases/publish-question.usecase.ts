import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { QuestionsRepository } from '../../infrastructure/questions-repository';
import { Question, QuestionStatus } from '../../domain/entities/question.entity';
import { DomainException } from '../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../core/exceptions/domain-exception-codes';
import { ValidationException } from '../../../../core/exceptions/validation-exception';

export class PublishQuestionCommand {
  constructor(public readonly id: number) {}
}

@CommandHandler(PublishQuestionCommand)
export class PublishQuestionUseCase implements ICommandHandler<PublishQuestionCommand> {
  constructor(private readonly questionsRepository: QuestionsRepository) {}

  async execute({ id }: PublishQuestionCommand): Promise<void> {
    const question: Question | null = await this.questionsRepository.getById(id);

    if (!question) {
      throw new DomainException({
        code: DomainExceptionCode.NotFound,
        message: `The question with ID (${id}) does not exist`,
      });
    }

    if (question.status === QuestionStatus.Published) {
      throw new DomainException({
        code: DomainExceptionCode.BadRequest,
        message: `The question with ID (${id}) already published`,
      });
    }

    if (question.correctAnswers.length < 1) {
      throw new ValidationException([
        {
          message: `Cannot publish question without correct answers`,
          field: 'correctAnswers',
        },
      ]);
    }

    question.publish();
    await this.questionsRepository.save(question);
  }
}
