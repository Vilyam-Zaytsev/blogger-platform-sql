import { QuestionInputDto } from '../../api/input-dto/question.input-dto';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Question } from '../../domain/entities/question.entity';
import { QuestionsRepository } from '../../infrastructure/questions-repository';

export class CreateQuestionCommand {
  constructor(public readonly dto: QuestionInputDto) {}
}

@CommandHandler(CreateQuestionCommand)
export class CreateQuestionUseCase implements ICommandHandler<CreateQuestionCommand> {
  constructor(private readonly questionRepository: QuestionsRepository) {}

  async execute({ dto }: CreateQuestionCommand): Promise<number> {
    const question: Question = Question.create(dto);

    return await this.questionRepository.save(question);
  }
}
