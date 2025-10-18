import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { QuestionsRepository } from '../../infrastructure/questions-repository';
import { Question, QuestionStatus } from '../../domain/entities/question.entity';
import { DomainException } from '../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../core/exceptions/domain-exception-codes';

export class RemovePublicationQuestionCommand {
  constructor(public readonly id: number) {}
}

@CommandHandler(RemovePublicationQuestionCommand)
export class RemovePublicationQuestionUseCase
  implements ICommandHandler<RemovePublicationQuestionCommand>
{
  constructor(private readonly questionsRepository: QuestionsRepository) {}

  async execute({ id }: RemovePublicationQuestionCommand): Promise<void> {
    const question: Question | null = await this.questionsRepository.getById(id);

    if (!question) {
      throw new DomainException({
        code: DomainExceptionCode.NotFound,
        message: `The question with ID (${id}) does not exist`,
      });
    }

    if (question.status === QuestionStatus.Draft) {
      throw new DomainException({
        code: DomainExceptionCode.BadRequest,
        message: `In order to remove a question from publication, it must be published.`,
      });
    }

    question.removePublication();
    await this.questionsRepository.save(question);
  }
}
