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

  it('должен снять с публикации вопрос, если администратор прошел проверку подлинности', async () => {
    // 🔻 Создаём один вопрос для тестирования публикации
    const [question]: QuestionViewDto[] = await quizTestManager.createQuestions(1);
    // 🔻 Публикуем вопрос
    await quizTestManager.publishQuestions([question.id]);

    // 🔻 Запрашиваем список всех вопросов после публикации
    const publishedQuestion: QuestionViewDto = (await quizTestManager.getAllQuestions()).items[0];

    // 🔸 Проверяем, что вопрос опубликован
    expect(publishedQuestion).toBeDefined();
    expect(publishedQuestion).not.toBeNull();
    expect(publishedQuestion.id).toBe(question.id);
    expect(publishedQuestion.published).toBe(true);
    expect(publishedQuestion.updatedAt).not.toBeNull();

    // 🔻 Отправляем запрос на снятие вопроса с публикации, с правильной авторизацией
    const resPublishQuestion: Response = await request(server)
      .put(`/${GLOBAL_PREFIX}/sa/quiz/questions/${question.id}/publish`)
      .set('Authorization', adminCredentialsInBase64)
      .send({ published: false })
      .expect(HttpStatus.NO_CONTENT);

    // 🔻 Запрашиваем список всех вопросов после снятия вопроса с публикации
    const { items: questions }: PaginatedViewDto<QuestionViewDto> =
      await quizTestManager.getAllQuestions();

    // 🔸 Проверяем, что вопрос снят с публикации
    expect(questions).toHaveLength(1);
    expect(questions[0].id).toBe(question.id);
    expect(questions[0].published).toBe(false);
    expect(questions[0].updatedAt).not.toBeNull();

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resPublishQuestion.body,
        resPublishQuestion.statusCode,
        'Test №1: QuestionsAdminController - publishOrRemovePublication() (PUT: /sa/quiz/questions/:id/publish)',
      );
    }
  });

  it('не должен снять с публикации вопрос, если администратор не прошел проверку подлинности', async () => {
    // 🔻 Создаём один вопрос для тестирования публикации
    const [question]: QuestionViewDto[] = await quizTestManager.createQuestions(1);
    // 🔻 Публикуем вопрос
    await quizTestManager.publishQuestions([question.id]);

    // 🔻 Запрашиваем список всех вопросов после публикации
    const publishedQuestion: QuestionViewDto = (await quizTestManager.getAllQuestions()).items[0];

    // 🔸 Проверяем, что вопрос опубликован
    expect(publishedQuestion).toBeDefined();
    expect(publishedQuestion).not.toBeNull();
    expect(publishedQuestion.id).toBe(question.id);
    expect(publishedQuestion.published).toBe(true);
    expect(publishedQuestion.updatedAt).not.toBeNull();

    // 🔻 Отправляем запрос на снятие вопроса с публикации, с не корректными данными админа
    const resPublishQuestion: Response = await request(server)
      .put(`/${GLOBAL_PREFIX}/sa/quiz/questions/${question.id}/publish`)
      .set('Authorization', 'incorrect admin credentials')
      .send({ published: true })
      .expect(HttpStatus.UNAUTHORIZED);

    // 🔻 Запрашиваем список всех вопросов после публикации
    const { items: questions }: PaginatedViewDto<QuestionViewDto> =
      await quizTestManager.getAllQuestions();

    // 🔸 Проверяем, что вопрос не снят с публикации
    expect(questions).toHaveLength(1);
    expect(questions[0].id).toBe(question.id);
    expect(questions[0].published).toBe(true);
    expect(questions[0].updatedAt).not.toBeNull();

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resPublishQuestion.body,
        resPublishQuestion.statusCode,
        'Test №2: QuestionsAdminController - publishOrRemovePublication() (PUT: /sa/quiz/questions/:id/publish)',
      );
    }
  });

  it('должен вернуть ошибку 404 если вопрос не найден', async () => {
    // 🔻 Создаём один вопрос для тестирования публикации
    const [question]: QuestionViewDto[] = await quizTestManager.createQuestions(1);
    // 🔻 Публикуем вопрос
    await quizTestManager.publishQuestions([question.id]);

    // 🔻 Запрашиваем список всех вопросов после публикации
    const publishedQuestion: QuestionViewDto = (await quizTestManager.getAllQuestions()).items[0];

    // 🔸 Проверяем, что вопрос опубликован
    expect(publishedQuestion).toBeDefined();
    expect(publishedQuestion).not.toBeNull();
    expect(publishedQuestion.id).toBe(question.id);
    expect(publishedQuestion.published).toBe(true);
    expect(publishedQuestion.updatedAt).not.toBeNull();

    // 🔻 Отправляем запрос на снятие вопроса с публикации, с не корректным id вопроса
    const resPublishQuestion: Response = await request(server)
      .put(`/${GLOBAL_PREFIX}/sa/quiz/questions/${'550e8400-e29b-41d4-a716-446655440000'}/publish`)
      .set('Authorization', adminCredentialsInBase64)
      .send({ published: true })
      .expect(HttpStatus.NOT_FOUND);

    // 🔻 Запрашиваем список всех вопросов после публикации
    const { items: questions }: PaginatedViewDto<QuestionViewDto> =
      await quizTestManager.getAllQuestions();

    // 🔸 Проверяем, что вопрос не снят с публикации
    expect(questions).toHaveLength(1);
    expect(questions[0].id).toBe(question.id);
    expect(questions[0].published).toBe(true);
    expect(questions[0].updatedAt).not.toBeNull();

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resPublishQuestion.body,
        resPublishQuestion.statusCode,
        'Test №3: QuestionsAdminController - publishOrRemovePublication() (PUT: /sa/quiz/questions/:id/publish)',
      );
    }
  });

  it('должен вернуть ошибку 400 если вопрос не опубликован', async () => {
    // 🔻 Создаём один вопрос для тестирования публикации
    const [question]: QuestionViewDto[] = await quizTestManager.createQuestions(1);

    // 🔻 Отправляем запрос на снятие вопроса с публикации
    const resPublishQuestion: Response = await request(server)
      .put(`/${GLOBAL_PREFIX}/sa/quiz/questions/${question.id}/publish`)
      .set('Authorization', adminCredentialsInBase64)
      .send({ published: false })
      .expect(HttpStatus.BAD_REQUEST);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resPublishQuestion.body,
        resPublishQuestion.statusCode,
        'Test №3: QuestionsAdminController - publishOrRemovePublication() (PUT: /sa/quiz/questions/:id/publish)',
      );
    }
  });
});
