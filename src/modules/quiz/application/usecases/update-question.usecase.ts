import { QuestionUpdateDto } from '../dto/question.update-dto';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { QuestionsRepository } from '../../infrastructure/questions-repository';
import { Question, QuestionStatus } from '../../domain/entities/question.entity';
import { DomainException } from '../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../core/exceptions/domain-exception-codes';
import { ValidationException } from '../../../../core/exceptions/validation-exception';

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

    if (question.status === QuestionStatus.Published && dto.correctAnswers.length < 1) {
      throw new ValidationException([
        {
          message: `Cannot publish question without correct answers`,
          field: 'correctAnswers',
        },
      ]);
    }

    question.update(dto);
    await this.questionsRepository.save(question);
  }
}
