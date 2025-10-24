import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { QuestionsRepository } from '../../infrastructure/questions-repository';
import { Question } from '../../domain/entities/question.entity';
import { DomainException } from '../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../core/exceptions/domain-exception-codes';

export class DeleteQuestionCommand {
  constructor(public readonly id: number) {}
}

@CommandHandler(DeleteQuestionCommand)
export class DeleteQuestionUseCase implements ICommandHandler<DeleteQuestionCommand> {
  constructor(private readonly questionsRepository: QuestionsRepository) {}

  async execute({ id }: DeleteQuestionCommand) {
    const question: Question | null = await this.questionsRepository.getById(id);

    if (!question) {
      throw new DomainException({
        code: DomainExceptionCode.NotFound,
        message: `The question with ID (${id}) does not exist`,
      });
    }

    await this.questionsRepository.softDelete(id);
  }
}