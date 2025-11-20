import { AppTestManager } from '../../managers/app.test-manager';
import { AdminCredentials } from '../../types';
import { Server } from 'http';
import { TestUtils } from '../../helpers/test.utils';
import { QuestionInputDto } from '../../../src/modules/quiz/admin/api/input-dto/question.input-dto';
import { TestDtoFactory } from '../../helpers/test.dto-factory';
import request, { Response } from 'supertest';
import { GLOBAL_PREFIX } from '../../../src/setup/global-prefix.setup';
import { HttpStatus } from '@nestjs/common';
import { QuizTestManager } from '../../managers/quiz.test.manager';
import { QuestionViewDto } from '../../../src/modules/quiz/admin/api/view-dto/question.view-dto';
import { TestLoggers } from '../../helpers/test.loggers';
import { PaginatedViewDto } from '../../../src/core/dto/paginated.view-dto';

describe('QuestionsAdminController - createQuestion() (POST: /sa/quiz/questions)', () => {
  let appTestManager: AppTestManager;
  let quizTestManager: QuizTestManager;
  let adminCredentials: AdminCredentials;
  let adminCredentialsInBase64: string;
  let testLoggingEnabled: boolean;
  let server: Server;

  beforeAll(async () => {
    appTestManager = new AppTestManager();
    await appTestManager.init();

    adminCredentials = appTestManager.getAdminCredentials();
    adminCredentialsInBase64 = TestUtils.encodingAdminDataInBase64(
      adminCredentials.login,
      adminCredentials.password,
    );
    server = appTestManager.getServer();
    testLoggingEnabled = appTestManager.coreConfig.testLoggingEnabled;

    quizTestManager = new QuizTestManager(server, adminCredentialsInBase64);
  });

  beforeEach(async () => {
    await appTestManager.cleanupDb(['migrations']);
  });

  afterAll(async () => {
    await appTestManager.close();
  });

  it('должен создать новый вопрос, если администратор прошел проверку подлинности', async () => {
    // 🔻 Генерируем входные данные (DTO) для вопроса
    const [dto]: QuestionInputDto[] = TestDtoFactory.generateQuestionInputDto(1);

    // 🔻 Отправляем запрос на создание вопроса от имени администратора
    const resCreateQuestion: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/sa/quiz/questions`)
      .send(dto)
      .set('Authorization', adminCredentialsInBase64)
      .expect(HttpStatus.CREATED);

    // 🔸 Проверяем, что тело ответа соответствует ожидаемому формату
    expect(resCreateQuestion.body).toEqual({
      id: expect.any(String),
      body: dto.body,
      correctAnswers: dto.correctAnswers,
      published: false,
      createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
      updatedAt: null,
    });

    const createdQuestion: QuestionViewDto = resCreateQuestion.body;

    // 🔻 Делаем GET-запрос sa/quiz/questions, чтобы убедиться, что вопрос действительно создан
    const findQuestion: QuestionViewDto = (await quizTestManager.getAllQuestions()).items[0];

    // 🔸 Сравниваем, что данные из ответа при создании совпадают с данными из GET-запроса
    expect(createdQuestion).toEqual({
      id: findQuestion.id,
      body: findQuestion.body,
      correctAnswers: findQuestion.correctAnswers,
      published: findQuestion.published,
      createdAt: findQuestion.createdAt,
      updatedAt: findQuestion.updatedAt,
    });

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resCreateQuestion.body,
        resCreateQuestion.statusCode,
        'Test №1: QuestionsAdminController - createQuestion() (POST: /sa/quiz/questions)',
      );
    }
  });

  it('не должен создать новый вопрос, если администратор не прошел проверку подлинности', async () => {
    // 🔻 Генерируем входные данные (DTO) для вопроса
    const [dto]: QuestionInputDto[] = TestDtoFactory.generateQuestionInputDto(1);

    // 🔻 Пытаемся создать вопрос с некорректными данными для авторизации
    const resCreateQuestion: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/sa/quiz/questions`)
      .send(dto)
      .set('Authorization', 'incorrect admin credentials') // намеренно некорректные креденшлы
      .expect(HttpStatus.UNAUTHORIZED);

    // 🔻 Получаем список вопросов через GET-запрос
    const { items: questions }: PaginatedViewDto<QuestionViewDto> =
      await quizTestManager.getAllQuestions();

    // 🔸 Проверяем, что вопрос не был создан
    expect(questions).toHaveLength(0);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resCreateQuestion.body,
        resCreateQuestion.statusCode,
        'Test №2: QuestionsAdminController - createQuestion() (POST: /sa/quiz/questions)',
      );
    }
  });

  it('не должен создавать вопрос, если данные в теле запроса неверны №1 (передается пустой объект)', async () => {
    // 🔻 Пытаемся создать вопрос с пустым объектом в теле запроса
    const resCreateQuestion: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/sa/quiz/questions`)
      .send({})
      .set('Authorization', adminCredentialsInBase64)
      .expect(HttpStatus.BAD_REQUEST);

    // 🔸 Проверяем, что сервер вернул ожидаемые ошибки валидации
    expect(resCreateQuestion.body).toEqual({
      errorsMessages: [
        {
          field: 'correctAnswers',
          message:
            'Each correctAnswer must be a string between 1 and 500 characters; Received value: undefined',
        },
        {
          field: 'body',
          message: 'body must be a string; Received value: undefined',
        },
      ],
    });

    // 🔻 Получаем список вопросов через GET-запрос
    const { items: questions }: PaginatedViewDto<QuestionViewDto> =
      await quizTestManager.getAllQuestions();

    // 🔸 Проверяем, что вопрос не был создан
    expect(questions).toHaveLength(0);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resCreateQuestion.body,
        resCreateQuestion.statusCode,
        'Test №3: QuestionsAdminController - createQuestion() (POST: /sa/quiz/questions)',
      );
    }
  });

  it('не должен создавать вопрос, если данные в теле запроса неверны №2 (body: пустая строка, correctAnswers: пустая строка)', async () => {
    // 🔻 Пытаемся создать вопрос, передав в теле запроса строки, состоящие только из пробелов
    const resCreateQuestion: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/sa/quiz/questions`)
      .send({
        body: '   ',
        correctAnswers: '   ',
      })
      .set('Authorization', adminCredentialsInBase64)
      .expect(HttpStatus.BAD_REQUEST);

    // 🔸 Проверяем, что сервер вернул ожидаемые ошибки валидации
    expect(resCreateQuestion.body).toEqual({
      errorsMessages: [
        {
          field: 'correctAnswers',
          message:
            'Each correctAnswer must be a string between 1 and 500 characters; Received value:    ',
        },
        {
          field: 'body',
          message: 'body must be longer than or equal to 10 characters; Received value: ',
        },
      ],
    });

    // 🔻 Получаем список вопросов через GET-запрос
    const { items: questions }: PaginatedViewDto<QuestionViewDto> =
      await quizTestManager.getAllQuestions();

    // 🔸 Проверяем, что вопрос не был создан
    expect(questions).toHaveLength(0);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resCreateQuestion.body,
        resCreateQuestion.statusCode,
        'Test №3: QuestionsAdminController - createQuestion() (POST: /sa/quiz/questions)',
      );
    }
  });

  it('не должен создавать вопрос, если данные в теле запроса неверны №3 (body: превышает максимальную длину, элементы correctAnswers: превышают максимальную длину)', async () => {
    // 🔻 Генерируем данные, которые превышают допустимые ограничения:
    const body: string = TestUtils.generateRandomString(501);
    const correctAnswers: string[] = Array.from({ length: 2 }, () =>
      TestUtils.generateRandomString(501),
    );

    // 🔻 Пытаемся создать вопрос с некорректными данными
    const resCreateQuestion: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/sa/quiz/questions`)
      .send({
        body,
        correctAnswers,
      })
      .set('Authorization', adminCredentialsInBase64)
      .expect(HttpStatus.BAD_REQUEST);

    // 🔸 Проверяем, что сервер вернул ожидаемые ошибки валидации
    expect(resCreateQuestion.body).toEqual({
      errorsMessages: [
        {
          field: 'correctAnswers',
          message: `Each correctAnswer must be a string between 1 and 500 characters; Received value: ${correctAnswers}`,
        },
        {
          field: 'body',
          message: `body must be shorter than or equal to 500 characters; Received value: ${body}`,
        },
      ],
    });

    // 🔻 Получаем список вопросов через GET-запрос
    const { items: questions }: PaginatedViewDto<QuestionViewDto> =
      await quizTestManager.getAllQuestions();

    // 🔸 Проверяем, что вопрос не был создан
    expect(questions).toHaveLength(0);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resCreateQuestion.body,
        resCreateQuestion.statusCode,
        'Test №4: QuestionsAdminController - createQuestion() (POST: /sa/quiz/questions)',
      );
    }
  });

  it('не должен создавать вопрос, если данные в теле запроса неверны №4 (body: type number, элементы correctAnswers: type number[])', async () => {
    // 🔻 Генерируем некорректные данные
    const body: number = 123;
    const correctAnswers: number[] = Array.from({ length: 2 }, (_, i) => i);

    // 🔻 Пытаемся создать вопрос с некорректными данными
    const resCreateQuestion: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/sa/quiz/questions`)
      .send({
        body,
        correctAnswers,
      })
      .set('Authorization', adminCredentialsInBase64)
      .expect(HttpStatus.BAD_REQUEST);

    // 🔸 Проверяем, что сервер вернул ожидаемые ошибки валидации
    expect(resCreateQuestion.body).toEqual({
      errorsMessages: [
        {
          field: 'correctAnswers',
          message: `Each correctAnswer must be a string between 1 and 500 characters; Received value: ${correctAnswers}`,
        },
        {
          field: 'body',
          message: `body must be a string; Received value: ${body}`,
        },
      ],
    });

    // 🔻 Получаем список вопросов через GET-запрос
    const { items: questions }: PaginatedViewDto<QuestionViewDto> =
      await quizTestManager.getAllQuestions();

    // 🔸 Проверяем, что вопрос не был создан
    expect(questions).toHaveLength(0);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resCreateQuestion.body,
        resCreateQuestion.statusCode,
        'Test №5: QuestionsAdminController - createQuestion() (POST: /sa/quiz/questions)',
      );
    }
  });

  it('не должен создавать вопрос, если данные в теле запроса неверны №4 (correctAnswers: массив пустых строк)', async () => {
    // 🔻 Генерируем некорректные данные
    const correctAnswers: string[] = Array.from({ length: 2 }, () => '  ');

    // 🔻 Пытаемся создать вопрос с некорректными данными
    const resCreateQuestion: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/sa/quiz/questions`)
      .send({
        body: TestUtils.generateRandomString(10),
        correctAnswers,
      })
      .set('Authorization', adminCredentialsInBase64)
      .expect(HttpStatus.BAD_REQUEST);

    // 🔸 Проверяем, что сервер вернул ожидаемые ошибки валидации
    expect(resCreateQuestion.body).toEqual({
      errorsMessages: [
        {
          field: 'correctAnswers',
          message: `Each correctAnswer must be a string between 1 and 500 characters; Received value: ${correctAnswers}`,
        },
      ],
    });

    // 🔻 Получаем список вопросов через GET-запрос
    const { items: questions }: PaginatedViewDto<QuestionViewDto> =
      await quizTestManager.getAllQuestions();

    // 🔸 Проверяем, что вопрос не был создан
    expect(questions).toHaveLength(0);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resCreateQuestion.body,
        resCreateQuestion.statusCode,
        'Test №6: QuestionsAdminController - createQuestion() (POST: /sa/quiz/questions)',
      );
    }
  });
});
