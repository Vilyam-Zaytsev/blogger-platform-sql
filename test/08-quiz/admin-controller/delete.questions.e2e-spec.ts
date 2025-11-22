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

describe('QuestionsAdminController - deleteQuestion() (DELETE: /sa/quiz/questions/:id)', () => {
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

  it('должен удалить вопрос, если администратор прошел проверку подлинности', async () => {
    // 🔻 Создаём один вопрос для тестирования удаления
    const [question]: QuestionViewDto[] = await quizTestManager.createQuestions(1);

    // 🔻 Отправляем запрос на удаление вопроса с правильной авторизацией
    const resDeleteQuestion: Response = await request(server)
      .delete(`/${GLOBAL_PREFIX}/sa/quiz/questions/${question.id}`)
      .set('Authorization', adminCredentialsInBase64)
      .expect(HttpStatus.NO_CONTENT);

    // 🔻 Запрашиваем список всех вопросов после удаления
    const { items: questions }: PaginatedViewDto<QuestionViewDto> =
      await quizTestManager.getAllQuestions();

    // 🔸 Проверяем, что список вопросов пуст (вопрос успешно удалён)
    expect(questions).toHaveLength(0);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resDeleteQuestion.body,
        resDeleteQuestion.statusCode,
        'Test №1: QuestionsAdminController - deleteQuestion() (DELETE: /sa/quiz/questions/:id)',
      );
    }
  });

  it('не должен удалить вопрос, если администратор не прошел проверку подлинности', async () => {
    // 🔻 Создаём один вопрос для тестирования удаления
    const [question]: QuestionViewDto[] = await quizTestManager.createQuestions(1);

    // 🔻 Пытаемся удалить вопрос с неверными учетными данными администратора
    const resDeleteQuestion: Response = await request(server)
      .delete(`/${GLOBAL_PREFIX}/sa/quiz/questions/${question.id}`)
      .set('Authorization', 'incorrect admin credentials')
      .expect(HttpStatus.UNAUTHORIZED);

    // 🔻 Запрашиваем список всех вопросов после удаления
    const { items: questions }: PaginatedViewDto<QuestionViewDto> =
      await quizTestManager.getAllQuestions();

    // 🔸 Проверяем, что вопрос остался без изменений
    expect(questions).toHaveLength(1);
    expect(question).toEqual(questions[0]);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resDeleteQuestion.body,
        resDeleteQuestion.statusCode,
        'Test №2: QuestionsAdminController - deleteQuestion() (DELETE: /sa/quiz/questions/:id)',
      );
    }
  });

  it('должен возвращать ошибку 404, если вопрос не был найден по переданному идентификатору в параметрах', async () => {
    // 🔻 Создаём один вопрос для тестирования удаления
    const [question]: QuestionViewDto[] = await quizTestManager.createQuestions(1);
    // 🔻 Используем некорректный ID для удаления
    const incorrectId: string = '1000000';

    // 🔻 Пытаемся удалить вопрос с некорректным ID, ожидаем 404 Not Found
    const resDeleteQuestion: Response = await request(server)
      .delete(`/${GLOBAL_PREFIX}/sa/quiz/questions/${incorrectId}`)
      .set('Authorization', adminCredentialsInBase64)
      .expect(HttpStatus.NOT_FOUND);

    // 🔻 Запрашиваем список всех вопросов после попытки удаления
    const { items: questions }: PaginatedViewDto<QuestionViewDto> =
      await quizTestManager.getAllQuestions();

    // 🔸 Проверяем, что вопрос остался без изменений
    expect(questions).toHaveLength(1);
    expect(question).toEqual(questions[0]);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resDeleteQuestion.body,
        resDeleteQuestion.statusCode,
        'Test №3: QuestionsAdminController - deleteQuestion() (DELETE: /sa/quiz/questions/:id)',
      );
    }
  });
});
