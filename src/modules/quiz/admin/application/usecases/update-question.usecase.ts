import { QuestionUpdateDto } from '../dto/question.update-dto';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { QuestionsRepository } from '../../infrastructure/questions-repository';
import { Question } from '../../domain/entities/question.entity';
import { QuestionValidatorService } from '../../domain/services/question-validator.service';

export class UpdateQuestionCommand {
  constructor(public readonly dto: QuestionUpdateDto) {}
}

@CommandHandler(UpdateQuestionCommand)
export class UpdateQuestionUseCase implements ICommandHandler<UpdateQuestionCommand> {
  constructor(
    private readonly questionsRepository: QuestionsRepository,
    private readonly questionValidatorService: QuestionValidatorService,
  ) {}

  async execute({ dto }: UpdateQuestionCommand): Promise<void> {
    const question: Question | null = await this.questionsRepository.getByPublicId(dto.id);
    const existingQuestion: Question = this.questionValidatorService.validateQuestionExists(
      question,
      dto.id,
    );

    this.questionValidatorService.validateQuestionBeforeUpdate(
      existingQuestion,
      dto.correctAnswers,
    );

    existingQuestion.update(dto);
    await this.questionsRepository.save(existingQuestion);
  }
}
