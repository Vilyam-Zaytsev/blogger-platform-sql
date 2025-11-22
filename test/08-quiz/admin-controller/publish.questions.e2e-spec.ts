import { AppTestManager } from '../../managers/app.test-manager';
import { AdminCredentials } from '../../types';
import { Server } from 'http';
import { TestUtils } from '../../helpers/test.utils';
import request, { Response } from 'supertest';
import { GLOBAL_PREFIX } from '../../../src/setup/global-prefix.setup';
import { HttpStatus } from '@nestjs/common';
import { QuizTestManager } from '../../managers/quiz.test.manager';
import { QuestionViewDto } from '../../../src/modules/quiz/admin/api/view-dto/question.view-dto';
import { TestLoggers } from '../../helpers/test.loggers';
import { PaginatedViewDto } from '../../../src/core/dto/paginated.view-dto';

describe('QuestionsAdminController - publishOrRemovePublication() (PUT: /sa/quiz/questions/:id/publish)', () => {
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

  it('должен опубликовать вопрос, если администратор прошел проверку подлинности, входные данные корректные и прошел валидацию для возможности публикации', async () => {
    // 🔻 Создаём один вопрос для тестирования публикации
    const [question]: QuestionViewDto[] = await quizTestManager.createQuestions(1);

    // 🔻 Отправляем запрос на публикацию вопроса с правильной авторизацией
    const resPublishQuestion: Response = await request(server)
      .put(`/${GLOBAL_PREFIX}/sa/quiz/questions/${question.id}/publish`)
      .set('Authorization', adminCredentialsInBase64)
      .send({ published: true })
      .expect(HttpStatus.NO_CONTENT);

    // 🔻 Запрашиваем список всех вопросов после публикации
    const { items: questions }: PaginatedViewDto<QuestionViewDto> =
      await quizTestManager.getAllQuestions();

    // 🔸 Проверяем, что вопрос опубликован
    expect(questions).toHaveLength(1);
    expect(questions[0].id).toBe(question.id);
    expect(questions[0].published).toBe(true);
    expect(questions[0].updatedAt).not.toBeNull();

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resPublishQuestion.body,
        resPublishQuestion.statusCode,
        'Test №1: QuestionsAdminController - publishOrRemovePublication() (PUT: /sa/quiz/questions/:id/publish)',
      );
    }
  });

  it('не должен опубликовать вопрос, если администратор не прошел проверку подлинности', async () => {
    // 🔻 Создаём один вопрос для тестирования публикации
    const [question]: QuestionViewDto[] = await quizTestManager.createQuestions(1);

    // 🔻 Отправляем запрос на публикацию вопроса с не корректными данными админа
    const resPublishQuestion: Response = await request(server)
      .put(`/${GLOBAL_PREFIX}/sa/quiz/questions/${question.id}/publish`)
      .set('Authorization', 'incorrect admin credentials')
      .send({ published: true })
      .expect(HttpStatus.UNAUTHORIZED);

    // 🔻 Запрашиваем список всех вопросов после публикации
    const { items: questions }: PaginatedViewDto<QuestionViewDto> =
      await quizTestManager.getAllQuestions();

    // 🔸 Проверяем, что вопрос не опубликован
    expect(questions).toHaveLength(1);
    expect(questions[0].id).toBe(question.id);
    expect(questions[0].published).toBe(false);
    expect(questions[0].updatedAt).toBeNull();

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resPublishQuestion.body,
        resPublishQuestion.statusCode,
        'Test №2: QuestionsAdminController - publishOrRemovePublication() (PUT: /sa/quiz/questions/:id/publish)',
      );
    }
  });

  it('не должен опубликовать вопрос, если вопрос не имеет списка правильных ответов', async () => {
    // 🔻 Создаём один вопрос для тестирования публикации
    const [question]: QuestionViewDto[] =
      await quizTestManager.createQuestionsWithNoCorrectAnswers(1);

    // 🔻 Отправляем запрос на публикацию вопроса (вопрос с пустым списком correctAnswers)
    const resPublishQuestion: Response = await request(server)
      .put(`/${GLOBAL_PREFIX}/sa/quiz/questions/${question.id}/publish`)
      .set('Authorization', adminCredentialsInBase64)
      .send({ published: true })
      .expect(HttpStatus.BAD_REQUEST);

    // 🔻 Проверяем, что сервер вернул ожидаемые сообщения об ошибках валидации
    expect(resPublishQuestion.body).toEqual({
      errorsMessages: [
        {
          field: 'correctAnswers',
          message: 'Cannot publish question without correct answers',
        },
      ],
    });

    // 🔻 Запрашиваем список всех вопросов после публикации
    const { items: questions }: PaginatedViewDto<QuestionViewDto> =
      await quizTestManager.getAllQuestions();

    // 🔸 Проверяем, что вопрос не опубликован
    expect(questions).toHaveLength(1);
    expect(questions[0].id).toBe(question.id);
    expect(questions[0].published).toBe(false);
    expect(questions[0].updatedAt).toBeNull();

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resPublishQuestion.body,
        resPublishQuestion.statusCode,
        'Test №3: QuestionsAdminController - publishOrRemovePublication() (PUT: /sa/quiz/questions/:id/publish)',
      );
    }
  });

  it('не должен опубликовать вопрос, если входные данные не корректные №1 (передаем пустой объект)', async () => {
    // 🔻 Создаём один вопрос для тестирования публикации
    const [question]: QuestionViewDto[] = await quizTestManager.createQuestions(1);

    // 🔻 Отправляем запрос на публикацию вопроса (в тело запроса передаем пустой объект)
    const resPublishQuestion: Response = await request(server)
      .put(`/${GLOBAL_PREFIX}/sa/quiz/questions/${question.id}/publish`)
      .set('Authorization', adminCredentialsInBase64)
      .send({})
      .expect(HttpStatus.BAD_REQUEST);

    // 🔻 Проверяем, что сервер вернул ожидаемые сообщения об ошибках валидации
    expect(resPublishQuestion.body).toEqual({
      errorsMessages: [
        {
          field: 'published',
          message: 'published must be a boolean value; Received value: undefined',
        },
      ],
    });

    // 🔻 Запрашиваем список всех вопросов после публикации
    const { items: questions }: PaginatedViewDto<QuestionViewDto> =
      await quizTestManager.getAllQuestions();

    // 🔸 Проверяем, что вопрос не опубликован
    expect(questions).toHaveLength(1);
    expect(questions[0].id).toBe(question.id);
    expect(questions[0].published).toBe(false);
    expect(questions[0].updatedAt).toBeNull();

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resPublishQuestion.body,
        resPublishQuestion.statusCode,
        'Test №4: QuestionsAdminController - publishOrRemovePublication() (PUT: /sa/quiz/questions/:id/publish)',
      );
    }
  });

  it('не должен опубликовать вопрос, если входные данные не корректные №2 ({published: string})', async () => {
    // 🔻 Создаём один вопрос для тестирования публикации
    const [question]: QuestionViewDto[] = await quizTestManager.createQuestions(1);

    // 🔻 Отправляем запрос на публикацию вопроса
    const resPublishQuestion: Response = await request(server)
      .put(`/${GLOBAL_PREFIX}/sa/quiz/questions/${question.id}/publish`)
      .set('Authorization', adminCredentialsInBase64)
      .send({ published: 'true' })
      .expect(HttpStatus.BAD_REQUEST);

    // 🔻 Проверяем, что сервер вернул ожидаемые сообщения об ошибках валидации
    expect(resPublishQuestion.body).toEqual({
      errorsMessages: [
        {
          field: 'published',
          message: 'published must be a boolean value; Received value: true',
        },
      ],
    });

    // 🔻 Запрашиваем список всех вопросов после публикации
    const { items: questions }: PaginatedViewDto<QuestionViewDto> =
      await quizTestManager.getAllQuestions();

    // 🔸 Проверяем, что вопрос не опубликован
    expect(questions).toHaveLength(1);
    expect(questions[0].id).toBe(question.id);
    expect(questions[0].published).toBe(false);
    expect(questions[0].updatedAt).toBeNull();

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resPublishQuestion.body,
        resPublishQuestion.statusCode,
        'Test №5: QuestionsAdminController - publishOrRemovePublication() (PUT: /sa/quiz/questions/:id/publish)',
      );
    }
  });

  it('не должен опубликовать вопрос, если входные данные не корректные №3 ({published: number})', async () => {
    // 🔻 Создаём один вопрос для тестирования публикации
    const [question]: QuestionViewDto[] = await quizTestManager.createQuestions(1);

    // 🔻 Отправляем запрос на публикацию вопроса
    const resPublishQuestion: Response = await request(server)
      .put(`/${GLOBAL_PREFIX}/sa/quiz/questions/${question.id}/publish`)
      .set('Authorization', adminCredentialsInBase64)
      .send({ published: 123 })
      .expect(HttpStatus.BAD_REQUEST);

    // 🔻 Проверяем, что сервер вернул ожидаемые сообщения об ошибках валидации
    expect(resPublishQuestion.body).toEqual({
      errorsMessages: [
        {
          field: 'published',
          message: 'published must be a boolean value; Received value: 123',
        },
      ],
    });

    // 🔻 Запрашиваем список всех вопросов после публикации
    const { items: questions }: PaginatedViewDto<QuestionViewDto> =
      await quizTestManager.getAllQuestions();

    // 🔸 Проверяем, что вопрос не опубликован
    expect(questions).toHaveLength(1);
    expect(questions[0].id).toBe(question.id);
    expect(questions[0].published).toBe(false);
    expect(questions[0].updatedAt).toBeNull();

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resPublishQuestion.body,
        resPublishQuestion.statusCode,
        'Test №6: QuestionsAdminController - publishOrRemovePublication() (PUT: /sa/quiz/questions/:id/publish)',
      );
    }
  });

  it('не должен опубликовать вопрос, если входные данные не корректные №4 ({published: object})', async () => {
    // 🔻 Создаём один вопрос для тестирования публикации
    const [question]: QuestionViewDto[] = await quizTestManager.createQuestions(1);

    // 🔻 Отправляем запрос на публикацию вопроса
    const resPublishQuestion: Response = await request(server)
      .put(`/${GLOBAL_PREFIX}/sa/quiz/questions/${question.id}/publish`)
      .set('Authorization', adminCredentialsInBase64)
      .send({ published: { published: true } })
      .expect(HttpStatus.BAD_REQUEST);

    // 🔻 Проверяем, что сервер вернул ожидаемые сообщения об ошибках валидации
    expect(resPublishQuestion.body).toEqual({
      errorsMessages: [
        {
          field: 'published',
          message: 'published must be a boolean value; Received value: [object Object]',
        },
      ],
    });

    // 🔻 Запрашиваем список всех вопросов после публикации
    const { items: questions }: PaginatedViewDto<QuestionViewDto> =
      await quizTestManager.getAllQuestions();

    // 🔸 Проверяем, что вопрос не опубликован
    expect(questions).toHaveLength(1);
    expect(questions[0].id).toBe(question.id);
    expect(questions[0].published).toBe(false);
    expect(questions[0].updatedAt).toBeNull();

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resPublishQuestion.body,
        resPublishQuestion.statusCode,
        'Test №7: QuestionsAdminController - publishOrRemovePublication() (PUT: /sa/quiz/questions/:id/publish)',
      );
    }
  });

  it('должен вернуть ошибку 400 если вопрос уже опубликован', async () => {
    // 🔻 Создаём один вопрос для тестирования публикации
    const [question]: QuestionViewDto[] = await quizTestManager.createQuestions(1);

    // 🔻 Отправляем запрос на публикацию вопроса
    await request(server)
      .put(`/${GLOBAL_PREFIX}/sa/quiz/questions/${question.id}/publish`)
      .set('Authorization', adminCredentialsInBase64)
      .send({ published: true })
      .expect(HttpStatus.NO_CONTENT);

    // Пытаемся повторно опубликовать тот же вопрос
    const resPublishQuestion: Response = await request(server)
      .put(`/${GLOBAL_PREFIX}/sa/quiz/questions/${question.id}/publish`)
      .set('Authorization', adminCredentialsInBase64)
      .send({ published: true })
      .expect(HttpStatus.BAD_REQUEST);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resPublishQuestion.body,
        resPublishQuestion.statusCode,
        'Test №8: QuestionsAdminController - publishOrRemovePublication() (PUT: /sa/quiz/questions/:id/publish)',
      );
    }
  });

  it('должен вернуть ошибку 404 если вопрос не найден)', async () => {
    // 🔻 Создаём один вопрос для тестирования публикации
    const [question]: QuestionViewDto[] = await quizTestManager.createQuestions(1);

    // 🔻 Отправляем запрос на публикацию вопроса
    const resPublishQuestion: Response = await request(server)
      .put(`/${GLOBAL_PREFIX}/sa/quiz/questions/${'550e8400-e29b-41d4-a716-446655440000'}/publish`)
      .set('Authorization', adminCredentialsInBase64)
      .send({ published: true })
      .expect(HttpStatus.NOT_FOUND);

    // 🔻 Запрашиваем список всех вопросов после публикации
    const { items: questions }: PaginatedViewDto<QuestionViewDto> =
      await quizTestManager.getAllQuestions();

    // 🔸 Проверяем, что вопрос не опубликован
    expect(questions).toHaveLength(1);
    expect(questions[0].id).toBe(question.id);
    expect(questions[0].published).toBe(false);
    expect(questions[0].updatedAt).toBeNull();

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resPublishQuestion.body,
        resPublishQuestion.statusCode,
        'Test №9: QuestionsAdminController - publishOrRemovePublication() (PUT: /sa/quiz/questions/:id/publish)',
      );
    }
  });
});
