import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { BasicAuthGuard } from '../../user-accounts/auth/domain/guards/basic/basic-auth.guard';
import { QuestionInputDto } from './input-dto/question.input-dto';
import { QuestionViewDto } from './view-dto/question.view-dto';
import { CommandBus } from '@nestjs/cqrs';
import { CreateQuestionCommand } from '../application/usecases/create-question.usecase';
import { QuestionQueryRepository } from '../infrastructure/query/question.query-repository';

@Controller('sa/quiz/questions')
@UseGuards(BasicAuthGuard)
export class QuestionsAdminController {
  constructor(
    private readonly commandBus: CommandBus,
    public readonly questionQueryRepository: QuestionQueryRepository,
  ) {}

  @Post()
  async createQuestion(@Body() body: QuestionInputDto): Promise<QuestionViewDto> {
    const idCreatedQuestion: number = await this.commandBus.execute(
      new CreateQuestionCommand(body),
    );

    return this.questionQueryRepository.getByIdOrNotFoundFail(idCreatedQuestion);
  }
}
