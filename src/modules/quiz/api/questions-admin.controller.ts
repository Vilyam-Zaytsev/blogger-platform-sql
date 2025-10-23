import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { BasicAuthGuard } from '../../user-accounts/auth/domain/guards/basic/basic-auth.guard';
import { QuestionInputDto } from './input-dto/question.input-dto';
import { QuestionViewDto } from './view-dto/question.view-dto';
import { CommandBus } from '@nestjs/cqrs';
import { CreateQuestionCommand } from '../application/usecases/create-question.usecase';
import { QuestionsQueryRepository } from '../infrastructure/query/questions-query-repository';
import { QuestionUpdateDto } from '../application/dto/question.update-dto';
import { UpdateQuestionCommand } from '../application/usecases/update-question.usecase';
import { PublishInputDto } from './input-dto/publish.input-dto';
import { PublishQuestionCommand } from '../application/usecases/publish-question.usecase';
import { RemovePublicationQuestionCommand } from '../application/usecases/remove-publication-question.usecase';
import { DeleteQuestionCommand } from '../application/usecases/delete-question.usecase';

@Controller('sa/quiz/questions')
@UseGuards(BasicAuthGuard)
export class QuestionsAdminController {
  constructor(
    private readonly commandBus: CommandBus,
    public readonly questionQueryRepository: QuestionsQueryRepository,
  ) {}

  @Post()
  async createQuestion(@Body() body: QuestionInputDto): Promise<QuestionViewDto> {
    const idCreatedQuestion: number = await this.commandBus.execute(
      new CreateQuestionCommand(body),
    );

    return this.questionQueryRepository.getByIdOrNotFoundFail(idCreatedQuestion);
  }

  @Put(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async updateQuestion(
    @Param('id', ParseIntPipe) id: number,
    @Body() { body, correctAnswers }: QuestionInputDto,
  ): Promise<void> {
    const dto: QuestionUpdateDto = {
      id,
      body,
      correctAnswers,
    };

    await this.commandBus.execute(new UpdateQuestionCommand(dto));
  }

  @Put(':id/publish')
  @HttpCode(HttpStatus.NO_CONTENT)
  async publishOrRemovePublication(
    @Param('id', ParseIntPipe) id: number,
    @Body() { published }: PublishInputDto,
  ): Promise<void> {
    if (published) {
      await this.commandBus.execute(new PublishQuestionCommand(id));
    } else {
      await this.commandBus.execute(new RemovePublicationQuestionCommand(id));
    }
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteQuestion(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.commandBus.execute(new DeleteQuestionCommand(id));
  }
}
