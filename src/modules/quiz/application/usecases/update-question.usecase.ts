import { QuestionUpdateDto } from '../dto/question.update-dto';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { QuestionsRepository } from '../../infrastructure/questions-repository';
import { Question } from '../../domain/entities/question.entity';
import { DomainException } from '../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../core/exceptions/domain-exception-codes';

export class UpdateQuestionCommand {
  constructor(public readonly dto: QuestionUpdateDto) {}
}

@CommandHandler(UpdateQuestionCommand)
export class UpdateQuestionUseCase implements ICommandHandler<UpdateQuestionCommand> {
  constructor(private readonly questionsRepository: QuestionsRepository) {}

  async execute({ dto }: UpdateQuestionCommand): Promise<void> {
    const question: Question | null = await this.questionsRepository.getById(dto.id);

    if (!question) {
      throw new DomainException({
        code: DomainExceptionCode.NotFound,
        message: `The question with ID (${dto.id}) does not exist`,
      });
    }

    question.update(dto);
    await this.questionsRepository.save(question);
  }
}
