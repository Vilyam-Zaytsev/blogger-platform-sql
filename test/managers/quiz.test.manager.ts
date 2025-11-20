import { Server } from 'http';
import { PaginatedViewDto } from '../../src/core/dto/paginated.view-dto';
import request, { Response } from 'supertest';
import { GLOBAL_PREFIX } from '../../src/setup/global-prefix.setup';
import { HttpStatus } from '@nestjs/common';
import { GetQuestionsQueryParams } from '../../src/modules/quiz/admin/api/input-dto/get-questions-query-params.input-dto';
import { QuestionViewDto } from '../../src/modules/quiz/admin/api/view-dto/question.view-dto';
import { TestDtoFactory } from '../helpers/test.dto-factory';
import { QuestionInputDto } from '../../src/modules/quiz/admin/api/input-dto/question.input-dto';

export class QuizTestManager {
  constructor(
    private readonly server: Server,
    private readonly adminCredentialsInBase64: string,
  ) {}

  async getAllQuestions(
    query: Partial<GetQuestionsQueryParams> = {},
  ): Promise<PaginatedViewDto<QuestionViewDto>> {
    const response: Response = await request(this.server)
      .get(`/${GLOBAL_PREFIX}/sa/quiz/questions`)
      .query(query)
      .set('Authorization', this.adminCredentialsInBase64)
      .expect(HttpStatus.OK);

    return response.body as PaginatedViewDto<QuestionViewDto>;
  }

  async createQuestions(quantity: number): Promise<QuestionViewDto[]> {
    const newQuestions: QuestionViewDto[] = [];
    const dtos: QuestionInputDto[] = TestDtoFactory.generateQuestionInputDto(quantity);

    for (let i = 0; i < quantity; i++) {
      const dto: QuestionInputDto = dtos[i];

      const response: Response = await request(this.server)
        .post(`/${GLOBAL_PREFIX}/sa/quiz/questions`)
        .send(dto)
        .set('Authorization', this.adminCredentialsInBase64)
        .expect(HttpStatus.CREATED);

      const newQuestion: QuestionViewDto = response.body as QuestionViewDto;

      expect(typeof newQuestion.id).toBe('string');
      expect(new Date(newQuestion.createdAt).toString()).not.toBe('Invalid Date');
      expect(newQuestion.updatedAt).toBe(null);
      expect(newQuestion.body).toBe(dto.body);
      expect(newQuestion.correctAnswers).toEqual(dto.correctAnswers);
      expect(newQuestion.published).toBe(false);

      newQuestions.push(newQuestion);
    }

    return newQuestions;
  }

  async createQuestionsWithNoCorrectAnswers(quantity: number): Promise<QuestionViewDto[]> {
    const newQuestions: QuestionViewDto[] = [];
    const dtos: QuestionInputDto[] = TestDtoFactory.generateQuestionInputDto(quantity);

    for (let i = 0; i < quantity; i++) {
      const dto: QuestionInputDto = dtos[i];
      dto.correctAnswers = [];

      const response: Response = await request(this.server)
        .post(`/${GLOBAL_PREFIX}/sa/quiz/questions`)
        .send(dto)
        .set('Authorization', this.adminCredentialsInBase64)
        .expect(HttpStatus.CREATED);

      const newQuestion: QuestionViewDto = response.body as QuestionViewDto;

      expect(typeof newQuestion.id).toBe('string');
      expect(new Date(newQuestion.createdAt).toString()).not.toBe('Invalid Date');
      expect(newQuestion.updatedAt).toBe(null);
      expect(newQuestion.body).toBe(dto.body);
      expect(newQuestion.correctAnswers).toEqual([]);
      expect(newQuestion.published).toBe(false);

      newQuestions.push(newQuestion);
    }

    return newQuestions;
  }

  // async publishQuestion(id: string, dto: PublishInputDto): Promise<void> {
  //
  // }
}
