import { Test, TestingModule } from '@nestjs/testing';
import { GetQuestionQueryHandler, GetQuestionsQuery } from './get-questions.query-handler';
import { DataSource, Repository } from 'typeorm';
import { Question } from '../../domain/entities/question.entity';
import { DatabaseModule } from '../../../../database/database.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getRelatedEntities } from '../../../../../core/utils/get-related-entities.utility';
import { QuestionsQueryRepository } from '../../infrastructure/query/questions-query-repository';
import { QuestionInputDto } from '../../api/input-dto/question.input-dto';
import { configModule } from '../../../../../dynamic-config.module';
import { PaginatedViewDto } from '../../../../../core/dto/paginated.view-dto';
import { QuestionViewDto } from '../../api/view-dto/question.view-dto';
import {
  GetQuestionsQueryParams,
  QuestionInputStatus,
  QuestionsSortBy,
} from '../../api/input-dto/get-questions-query-params.input-dto';
import { SortDirection } from '../../../../../core/dto/base.query-params.input-dto';

describe('GetQuestionQueryHandler (Integration)', () => {
  let module: TestingModule;
  let handler: GetQuestionQueryHandler;
  let questionsQueryRepository: QuestionsQueryRepository;
  let dataSource: DataSource;
  let questionRepo: Repository<Question>;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        configModule,
        DatabaseModule,
        TypeOrmModule.forFeature(getRelatedEntities(Question)),
      ],
      providers: [GetQuestionQueryHandler, QuestionsQueryRepository],
    }).compile();

    handler = module.get<GetQuestionQueryHandler>(GetQuestionQueryHandler);
    questionsQueryRepository = module.get<QuestionsQueryRepository>(QuestionsQueryRepository);
    dataSource = module.get<DataSource>(DataSource);
    questionRepo = dataSource.getRepository<Question>(Question);
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE TABLE questions RESTART IDENTITY CASCADE');
  });

  afterAll(async () => {
    await dataSource.destroy();
    await module.close();
  });

  const createTestQuestion = async (
    questionData?: Partial<QuestionInputDto>,
  ): Promise<Question> => {
    const defaultData: QuestionInputDto = {
      body: 'What is the capital of France?',
      correctAnswers: ['Paris'],
      ...questionData,
    };

    const question: Question = Question.create(defaultData);
    return await questionRepo.save(question);
  };

  const createTestPublishedQuestion = async (
    questionData?: Partial<QuestionInputDto>,
  ): Promise<Question> => {
    const defaultData: QuestionInputDto = {
      body: 'What is the capital of France?',
      correctAnswers: ['Paris'],
      ...questionData,
    };

    const question: Question = Question.create(defaultData);
    question.publish();
    return await questionRepo.save(question);
  };

  describe('Позитивные сценарии - базовая пагинация', () => {
    it('должен вернуть пустой список при отсутствии вопросов', async () => {
      const queryParams: GetQuestionsQueryParams = new GetQuestionsQueryParams();

      const result: PaginatedViewDto<QuestionViewDto> = await handler.execute(
        new GetQuestionsQuery(queryParams),
      );

      expect(result).toBeDefined();
      expect(result.items).toEqual([]);
      expect(result.totalCount).toBe(0);
      expect(result.pagesCount).toBe(0);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
    });

    it('должен вернуть список всех вопросов с дефолтной пагинацией', async () => {
      await createTestQuestion({ body: 'Question 1', correctAnswers: ['Answer 1'] });
      await createTestQuestion({ body: 'Question 2', correctAnswers: ['Answer 2'] });
      await createTestQuestion({ body: 'Question 3', correctAnswers: ['Answer 3'] });

      const queryParams: GetQuestionsQueryParams = new GetQuestionsQueryParams();

      const result: PaginatedViewDto<QuestionViewDto> = await handler.execute(
        new GetQuestionsQuery(queryParams),
      );

      expect(result.items).toHaveLength(3);
      expect(result.totalCount).toBe(3);
      expect(result.pagesCount).toBe(1);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
    });

    it('должен вернуть вопросы с корректной пагинацией (pageSize=2, pageNumber=1)', async () => {
      for (let i = 1; i <= 5; i++) {
        await createTestQuestion({ body: `Question ${i}`, correctAnswers: [`Answer ${i}`] });
      }

      const queryParams: GetQuestionsQueryParams = new GetQuestionsQueryParams();
      queryParams.pageSize = 2;
      queryParams.pageNumber = 1;

      const result: PaginatedViewDto<QuestionViewDto> = await handler.execute(
        new GetQuestionsQuery(queryParams),
      );

      expect(result.items).toHaveLength(2);
      expect(result.totalCount).toBe(5);
      expect(result.pagesCount).toBe(3);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(2);
    });

    it('должен вернуть вопросы со второй страницы (pageSize=2, pageNumber=2)', async () => {
      for (let i = 1; i <= 5; i++) {
        await createTestQuestion({ body: `Question ${i}`, correctAnswers: [`Answer ${i}`] });
      }

      const queryParams: GetQuestionsQueryParams = new GetQuestionsQueryParams();
      queryParams.pageSize = 2;
      queryParams.pageNumber = 2;

      const result: PaginatedViewDto<QuestionViewDto> = await handler.execute(
        new GetQuestionsQuery(queryParams),
      );

      expect(result.items).toHaveLength(2);
      expect(result.totalCount).toBe(5);
      expect(result.pagesCount).toBe(3);
      expect(result.page).toBe(2);
    });

    it('должен вернуть последнюю страницу с неполным набором элементов', async () => {
      for (let i = 1; i <= 5; i++) {
        await createTestQuestion({ body: `Question ${i}`, correctAnswers: [`Answer ${i}`] });
      }

      const queryParams: GetQuestionsQueryParams = new GetQuestionsQueryParams();
      queryParams.pageSize = 2;
      queryParams.pageNumber = 3;

      const result: PaginatedViewDto<QuestionViewDto> = await handler.execute(
        new GetQuestionsQuery(queryParams),
      );

      expect(result.items).toHaveLength(1);
      expect(result.totalCount).toBe(5);
      expect(result.pagesCount).toBe(3);
      expect(result.page).toBe(3);
    });

    it('должен вернуть пустой список для несуществующей страницы', async () => {
      await createTestQuestion({ body: 'Question 1', correctAnswers: ['Answer 1'] });

      const queryParams: GetQuestionsQueryParams = new GetQuestionsQueryParams();
      queryParams.pageSize = 10;
      queryParams.pageNumber = 999;

      const result: PaginatedViewDto<QuestionViewDto> = await handler.execute(
        new GetQuestionsQuery(queryParams),
      );

      expect(result.items).toHaveLength(0);
      expect(result.totalCount).toBe(1);
      expect(result.pagesCount).toBe(1);
      expect(result.page).toBe(999);
    });
  });

  describe('Позитивные сценарии - сортировка', () => {
    it('должен вернуть вопросы отсортированные по createdAt DESC (по умолчанию)', async () => {
      const q1: Question = await createTestQuestion({ body: 'First question' });
      await new Promise((resolve) => setTimeout(resolve, 10));
      const q2: Question = await createTestQuestion({ body: 'Second question' });
      await new Promise((resolve) => setTimeout(resolve, 10));
      const q3: Question = await createTestQuestion({ body: 'Third question' });

      const queryParams: GetQuestionsQueryParams = new GetQuestionsQueryParams();

      const result: PaginatedViewDto<QuestionViewDto> = await handler.execute(
        new GetQuestionsQuery(queryParams),
      );

      expect(result.items).toHaveLength(3);
      expect(result.items[0].id).toBe(q3.publicId);
      expect(result.items[1].id).toBe(q2.publicId);
      expect(result.items[2].id).toBe(q1.publicId);
    });

    it('должен вернуть вопросы отсортированные по createdAt ASC', async () => {
      const q1 = await createTestQuestion({ body: 'First question' });
      await new Promise((resolve) => setTimeout(resolve, 10));
      const q2 = await createTestQuestion({ body: 'Second question' });
      await new Promise((resolve) => setTimeout(resolve, 10));
      const q3 = await createTestQuestion({ body: 'Third question' });

      const queryParams: GetQuestionsQueryParams = new GetQuestionsQueryParams();
      queryParams.sortBy = QuestionsSortBy.CreatedAt;
      queryParams.sortDirection = SortDirection.Ascending;

      const result: PaginatedViewDto<QuestionViewDto> = await handler.execute(
        new GetQuestionsQuery(queryParams),
      );

      expect(result.items).toHaveLength(3);
      expect(result.items[0].id).toBe(q1.publicId);
      expect(result.items[1].id).toBe(q2.publicId);
      expect(result.items[2].id).toBe(q3.publicId);
    });

    it('должен вернуть вопросы отсортированные по body ASC', async () => {
      await createTestQuestion({ body: 'Zebra question' });
      await createTestQuestion({ body: 'Apple question' });
      await createTestQuestion({ body: 'Mango question' });

      const queryParams: GetQuestionsQueryParams = new GetQuestionsQueryParams();
      queryParams.sortBy = QuestionsSortBy.Body;
      queryParams.sortDirection = SortDirection.Ascending;

      const result: PaginatedViewDto<QuestionViewDto> = await handler.execute(
        new GetQuestionsQuery(queryParams),
      );

      expect(result.items).toHaveLength(3);
      expect(result.items[0].body).toBe('Apple question');
      expect(result.items[1].body).toBe('Mango question');
      expect(result.items[2].body).toBe('Zebra question');
    });

    it('должен вернуть вопросы отсортированные по body DESC', async () => {
      await createTestQuestion({ body: 'Zebra question' });
      await createTestQuestion({ body: 'Apple question' });
      await createTestQuestion({ body: 'Mango question' });

      const queryParams: GetQuestionsQueryParams = new GetQuestionsQueryParams();
      queryParams.sortBy = QuestionsSortBy.Body;
      queryParams.sortDirection = SortDirection.Descending;

      const result: PaginatedViewDto<QuestionViewDto> = await handler.execute(
        new GetQuestionsQuery(queryParams),
      );

      expect(result.items).toHaveLength(3);
      expect(result.items[0].body).toBe('Zebra question');
      expect(result.items[1].body).toBe('Mango question');
      expect(result.items[2].body).toBe('Apple question');
    });

    it('должен вернуть вопросы отсортированные по status ASC', async () => {
      await createTestPublishedQuestion({ body: 'Published 1' });
      await createTestQuestion({ body: 'Not published 1' });
      await createTestPublishedQuestion({ body: 'Published 2' });

      const queryParams: GetQuestionsQueryParams = new GetQuestionsQueryParams();
      queryParams.sortBy = QuestionsSortBy.Status;
      queryParams.sortDirection = SortDirection.Ascending;

      const result: PaginatedViewDto<QuestionViewDto> = await handler.execute(
        new GetQuestionsQuery(queryParams),
      );

      expect(result.items).toHaveLength(3);
      expect(result.items[0].published).toBe(false);
      expect(result.items[1].published).toBe(true);
      expect(result.items[2].published).toBe(true);
    });
  });

  describe('Позитивные сценарии - фильтрация по bodySearchTerm', () => {
    it('должен вернуть вопросы, содержащие bodySearchTerm', async () => {
      await createTestQuestion({ body: 'What is TypeScript?' });
      await createTestQuestion({ body: 'What is JavaScript?' });
      await createTestQuestion({ body: 'What is Python?' });

      const queryParams: GetQuestionsQueryParams = new GetQuestionsQueryParams();
      queryParams.bodySearchTerm = 'Script';

      const result: PaginatedViewDto<QuestionViewDto> = await handler.execute(
        new GetQuestionsQuery(queryParams),
      );

      expect(result.items).toHaveLength(2);
      expect(result.totalCount).toBe(2);
      expect(result.items.every((q) => q.body.includes('Script'))).toBe(true);
    });

    it('должен вернуть пустой список, если bodySearchTerm не найден', async () => {
      await createTestQuestion({ body: 'What is TypeScript?' });
      await createTestQuestion({ body: 'What is JavaScript?' });

      const queryParams: GetQuestionsQueryParams = new GetQuestionsQueryParams();
      queryParams.bodySearchTerm = 'Python';

      const result: PaginatedViewDto<QuestionViewDto> = await handler.execute(
        new GetQuestionsQuery(queryParams),
      );

      expect(result.items).toHaveLength(0);
      expect(result.totalCount).toBe(0);
    });

    it('должен игнорировать регистр при поиске (ILIKE)', async () => {
      await createTestQuestion({ body: 'What is TypeScript?' });
      await createTestQuestion({ body: 'What is typescript?' });
      await createTestQuestion({ body: 'TYPESCRIPT is great' });

      const queryParams: GetQuestionsQueryParams = new GetQuestionsQueryParams();
      queryParams.bodySearchTerm = 'typescript';

      const result: PaginatedViewDto<QuestionViewDto> = await handler.execute(
        new GetQuestionsQuery(queryParams),
      );

      expect(result.items).toHaveLength(3);
      expect(result.totalCount).toBe(3);
    });

    it('должен искать по части слова в bodySearchTerm', async () => {
      await createTestQuestion({ body: 'Programming languages' });
      await createTestQuestion({ body: 'Program testing' });
      await createTestQuestion({ body: 'Software development' });

      const queryParams: GetQuestionsQueryParams = new GetQuestionsQueryParams();
      queryParams.bodySearchTerm = 'gram';

      const result: PaginatedViewDto<QuestionViewDto> = await handler.execute(
        new GetQuestionsQuery(queryParams),
      );

      expect(result.items).toHaveLength(2);
      expect(result.items.every((q) => q.body.toLowerCase().includes('gram'))).toBe(true);
    });

    it('должен вернуть все вопросы, если bodySearchTerm = null', async () => {
      await createTestQuestion({ body: 'Question 1' });
      await createTestQuestion({ body: 'Question 2' });
      await createTestQuestion({ body: 'Question 3' });

      const queryParams: GetQuestionsQueryParams = new GetQuestionsQueryParams();
      queryParams.bodySearchTerm = null;

      const result: PaginatedViewDto<QuestionViewDto> = await handler.execute(
        new GetQuestionsQuery(queryParams),
      );

      expect(result.items).toHaveLength(3);
      expect(result.totalCount).toBe(3);
    });

    it('должен найти вопрос по специальным символам в bodySearchTerm', async () => {
      await createTestQuestion({ body: 'What is "TypeScript"?' });
      await createTestQuestion({ body: 'What is JavaScript?' });

      const queryParams: GetQuestionsQueryParams = new GetQuestionsQueryParams();
      queryParams.bodySearchTerm = '"TypeScript"';

      const result: PaginatedViewDto<QuestionViewDto> = await handler.execute(
        new GetQuestionsQuery(queryParams),
      );

      expect(result.items).toHaveLength(1);
      expect(result.items[0].body).toContain('"TypeScript"');
    });
  });

  describe('Позитивные сценарии - фильтрация по publishedStatus', () => {
    it('должен вернуть только опубликованные вопросы (publishedStatus = Published)', async () => {
      await createTestPublishedQuestion({ body: 'Published 1' });
      await createTestQuestion({ body: 'Not published 1' });
      await createTestPublishedQuestion({ body: 'Published 2' });
      await createTestQuestion({ body: 'Not published 2' });

      const queryParams: GetQuestionsQueryParams = new GetQuestionsQueryParams();
      queryParams.publishedStatus = QuestionInputStatus.Published;

      const result: PaginatedViewDto<QuestionViewDto> = await handler.execute(
        new GetQuestionsQuery(queryParams),
      );

      expect(result.items).toHaveLength(2);
      expect(result.totalCount).toBe(2);
      expect(result.items.every((q) => q.published === true)).toBe(true);
    });

    it('должен вернуть только неопубликованные вопросы (publishedStatus = NotPublished)', async () => {
      await createTestPublishedQuestion({ body: 'Published 1' });
      await createTestQuestion({ body: 'Not published 1' });
      await createTestPublishedQuestion({ body: 'Published 2' });
      await createTestQuestion({ body: 'Not published 2' });

      const queryParams: GetQuestionsQueryParams = new GetQuestionsQueryParams();
      queryParams.publishedStatus = QuestionInputStatus.NotPublished;

      const result: PaginatedViewDto<QuestionViewDto> = await handler.execute(
        new GetQuestionsQuery(queryParams),
      );

      expect(result.items).toHaveLength(2);
      expect(result.totalCount).toBe(2);
      expect(result.items.every((q) => q.published === false)).toBe(true);
    });

    it('должен вернуть все вопросы (publishedStatus = All)', async () => {
      await createTestPublishedQuestion({ body: 'Published 1' });
      await createTestQuestion({ body: 'Not published 1' });
      await createTestPublishedQuestion({ body: 'Published 2' });

      const queryParams: GetQuestionsQueryParams = new GetQuestionsQueryParams();
      queryParams.publishedStatus = QuestionInputStatus.All;

      const result: PaginatedViewDto<QuestionViewDto> = await handler.execute(
        new GetQuestionsQuery(queryParams),
      );

      expect(result.items).toHaveLength(3);
      expect(result.totalCount).toBe(3);
    });

    it('должен вернуть все вопросы по умолчанию (publishedStatus не указан)', async () => {
      await createTestPublishedQuestion({ body: 'Published 1' });
      await createTestQuestion({ body: 'Not published 1' });

      const queryParams: GetQuestionsQueryParams = new GetQuestionsQueryParams();

      const result: PaginatedViewDto<QuestionViewDto> = await handler.execute(
        new GetQuestionsQuery(queryParams),
      );

      expect(result.items).toHaveLength(2);
      expect(result.totalCount).toBe(2);
    });

    it('должен вернуть пустой список, если нет опубликованных вопросов', async () => {
      await createTestQuestion({ body: 'Not published 1' });
      await createTestQuestion({ body: 'Not published 2' });

      const queryParams: GetQuestionsQueryParams = new GetQuestionsQueryParams();
      queryParams.publishedStatus = QuestionInputStatus.Published;

      const result: PaginatedViewDto<QuestionViewDto> = await handler.execute(
        new GetQuestionsQuery(queryParams),
      );

      expect(result.items).toHaveLength(0);
      expect(result.totalCount).toBe(0);
    });
  });

  describe('Комбинированные фильтры', () => {
    it('должен применить bodySearchTerm и publishedStatus одновременно', async () => {
      await createTestPublishedQuestion({ body: 'TypeScript is great' });
      await createTestQuestion({ body: 'TypeScript tutorial' });
      await createTestPublishedQuestion({ body: 'JavaScript is awesome' });

      const queryParams: GetQuestionsQueryParams = new GetQuestionsQueryParams();
      queryParams.bodySearchTerm = 'TypeScript';
      queryParams.publishedStatus = QuestionInputStatus.Published;

      const result: PaginatedViewDto<QuestionViewDto> = await handler.execute(
        new GetQuestionsQuery(queryParams),
      );

      expect(result.items).toHaveLength(1);
      expect(result.items[0].body).toContain('TypeScript');
      expect(result.items[0].published).toBe(true);
    });

    it('должен применить bodySearchTerm, publishedStatus и сортировку', async () => {
      await createTestPublishedQuestion({ body: 'Zebra TypeScript' });
      await createTestPublishedQuestion({ body: 'Apple TypeScript' });
      await createTestQuestion({ body: 'TypeScript guide' });

      const queryParams: GetQuestionsQueryParams = new GetQuestionsQueryParams();
      queryParams.bodySearchTerm = 'TypeScript';
      queryParams.publishedStatus = QuestionInputStatus.Published;
      queryParams.sortBy = QuestionsSortBy.Body;
      queryParams.sortDirection = SortDirection.Ascending;

      const result: PaginatedViewDto<QuestionViewDto> = await handler.execute(
        new GetQuestionsQuery(queryParams),
      );

      expect(result.items).toHaveLength(2);
      expect(result.items[0].body).toBe('Apple TypeScript');
      expect(result.items[1].body).toBe('Zebra TypeScript');
    });

    it('должен применить все фильтры и пагинацию', async () => {
      for (let i = 1; i <= 10; i++) {
        await createTestPublishedQuestion({ body: `TypeScript question ${i}` });
      }

      await createTestQuestion({ body: 'TypeScript not published' });

      const queryParams: GetQuestionsQueryParams = new GetQuestionsQueryParams();
      queryParams.bodySearchTerm = 'TypeScript';
      queryParams.publishedStatus = QuestionInputStatus.Published;
      queryParams.pageSize = 3;
      queryParams.pageNumber = 2;

      const result: PaginatedViewDto<QuestionViewDto> = await handler.execute(
        new GetQuestionsQuery(queryParams),
      );

      expect(result.items).toHaveLength(3);
      expect(result.totalCount).toBe(10);
      expect(result.pagesCount).toBe(4);
      expect(result.page).toBe(2);
    });

    it('должен вернуть пустой список при комбинации фильтров без совпадений', async () => {
      await createTestPublishedQuestion({ body: 'JavaScript question' });
      await createTestQuestion({ body: 'TypeScript question' });

      const queryParams: GetQuestionsQueryParams = new GetQuestionsQueryParams();
      queryParams.bodySearchTerm = 'TypeScript';
      queryParams.publishedStatus = QuestionInputStatus.Published;

      const result: PaginatedViewDto<QuestionViewDto> = await handler.execute(
        new GetQuestionsQuery(queryParams),
      );

      expect(result.items).toHaveLength(0);
      expect(result.totalCount).toBe(0);
    });
  });

  describe('Проверка взаимодействия с репозиторием', () => {
    it('должен вызвать getAll при выполнении запроса', async () => {
      await createTestQuestion({ body: 'Test question' });

      const getAllSpy = jest.spyOn(questionsQueryRepository, 'getAll');

      const queryParams: GetQuestionsQueryParams = new GetQuestionsQueryParams();

      await handler.execute(new GetQuestionsQuery(queryParams));

      expect(getAllSpy).toHaveBeenCalledWith(queryParams);
      expect(getAllSpy).toHaveBeenCalledTimes(1);

      getAllSpy.mockRestore();
    });

    it('должен передать правильные параметры в getAll', async () => {
      const getAllSpy = jest.spyOn(questionsQueryRepository, 'getAll');

      const queryParams: GetQuestionsQueryParams = new GetQuestionsQueryParams();
      queryParams.pageSize = 5;
      queryParams.pageNumber = 2;
      queryParams.sortBy = QuestionsSortBy.Body;
      queryParams.sortDirection = SortDirection.Ascending;
      queryParams.bodySearchTerm = 'Test';
      queryParams.publishedStatus = QuestionInputStatus.Published;

      await handler.execute(new GetQuestionsQuery(queryParams));

      expect(getAllSpy).toHaveBeenCalledWith(queryParams);
      expect(getAllSpy.mock.calls[0][0].pageSize).toBe(5);
      expect(getAllSpy.mock.calls[0][0].pageNumber).toBe(2);
      expect(getAllSpy.mock.calls[0][0].sortBy).toBe(QuestionsSortBy.Body);
      expect(getAllSpy.mock.calls[0][0].sortDirection).toBe(SortDirection.Ascending);
      expect(getAllSpy.mock.calls[0][0].bodySearchTerm).toBe('Test');
      expect(getAllSpy.mock.calls[0][0].publishedStatus).toBe(QuestionInputStatus.Published);

      getAllSpy.mockRestore();
    });

    it('должен вернуть результат от getAll без изменений', async () => {
      await createTestQuestion({ body: 'Question 1' });
      await createTestQuestion({ body: 'Question 2' });

      const queryParams: GetQuestionsQueryParams = new GetQuestionsQueryParams();

      const result: PaginatedViewDto<QuestionViewDto> = await handler.execute(
        new GetQuestionsQuery(queryParams),
      );

      const directResult: PaginatedViewDto<QuestionViewDto> =
        await questionsQueryRepository.getAll(queryParams);

      expect(result).toEqual(directResult);
    });
  });

  describe('Граничные случаи', () => {
    it('должен игнорировать удаленные вопросы (soft delete)', async () => {
      const q1 = await createTestQuestion({ body: 'Question 1' });
      await createTestQuestion({ body: 'Question 2' });

      await questionRepo.softDelete(q1.id);

      const queryParams: GetQuestionsQueryParams = new GetQuestionsQueryParams();

      const result: PaginatedViewDto<QuestionViewDto> = await handler.execute(
        new GetQuestionsQuery(queryParams),
      );

      expect(result.items).toHaveLength(1);
      expect(result.totalCount).toBe(1);
      expect(result.items[0].body).toBe('Question 2');
    });
  });

  describe('Структура возвращаемых данных', () => {
    it('должен вернуть QuestionViewDto с корректными полями', async () => {
      const questionData: QuestionInputDto = {
        body: 'What is TypeScript?',
        correctAnswers: ['A typed superset of JavaScript'],
      };

      await createTestPublishedQuestion(questionData);

      const queryParams: GetQuestionsQueryParams = new GetQuestionsQueryParams();

      const result: PaginatedViewDto<QuestionViewDto> = await handler.execute(
        new GetQuestionsQuery(queryParams),
      );

      expect(result.items).toHaveLength(1);

      const question = result.items[0];
      expect(question).toHaveProperty('id');
      expect(question).toHaveProperty('body');
      expect(question).toHaveProperty('correctAnswers');
      expect(question).toHaveProperty('published');
      expect(question).toHaveProperty('createdAt');
      expect(question).toHaveProperty('updatedAt');

      expect(question.body).toBe('What is TypeScript?');
      expect(question.correctAnswers).toEqual(['A typed superset of JavaScript']);
      expect(question.published).toBe(true);
      expect(question.createdAt).toBeDefined();
      expect(question.updatedAt).toBeDefined();
    });

    it('должен вернуть PaginatedViewDto с корректной структурой', async () => {
      await createTestQuestion({ body: 'Question 1' });

      const queryParams: GetQuestionsQueryParams = new GetQuestionsQueryParams();

      const result: PaginatedViewDto<QuestionViewDto> = await handler.execute(
        new GetQuestionsQuery(queryParams),
      );

      expect(result).toHaveProperty('pagesCount');
      expect(result).toHaveProperty('page');
      expect(result).toHaveProperty('pageSize');
      expect(result).toHaveProperty('totalCount');
      expect(result).toHaveProperty('items');

      expect(Array.isArray(result.items)).toBe(true);
      expect(typeof result.pagesCount).toBe('number');
      expect(typeof result.page).toBe('number');
      expect(typeof result.pageSize).toBe('number');
      expect(typeof result.totalCount).toBe('number');
    });
  });
});
