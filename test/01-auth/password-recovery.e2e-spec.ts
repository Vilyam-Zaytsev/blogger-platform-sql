import { UsersTestManager } from '../managers/users.test-manager';
import { TestLoggers } from '../helpers/test.loggers';
import { AppTestManager } from '../managers/app.test-manager';
import { AdminCredentials } from '../types';
import { Server } from 'http';
import { EmailTemplate } from '../../src/modules/notifications/templates/types';
import request, { Response } from 'supertest';
import { GLOBAL_PREFIX } from '../../src/setup/global-prefix.setup';
import { TestUtils } from '../helpers/test.utils';
import { HttpStatus } from '@nestjs/common';
import { UsersRepository } from '../../src/modules/user-accounts/users/infrastructure/users.repository';
import { EmailService } from '../../src/modules/notifications/services/email.service';
import { UserViewDto } from '../../src/modules/user-accounts/users/api/view-dto/user.view-dto';
import { CryptoService } from '../../src/modules/user-accounts/users/application/services/crypto.service';
import { PasswordRecoveryDbType } from '../../src/modules/user-accounts/auth/types/password-recovery-db.type';
import SpyInstance = jest.SpyInstance;

describe('AuthController - passwordRecovery() (POST: /auth)', () => {
  let appTestManager: AppTestManager;
  let usersTestManager: UsersTestManager;
  let usersRepository: UsersRepository;
  let cryptoService: CryptoService;
  let adminCredentials: AdminCredentials;
  let adminCredentialsInBase64: string;
  let testLoggingEnabled: boolean;
  let server: Server;
  let sendEmailMock: jest.Mock;
  let spy: SpyInstance;

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

    usersTestManager = new UsersTestManager(server, adminCredentialsInBase64);
    cryptoService = appTestManager.app.get(CryptoService);
    usersRepository = appTestManager.app.get(UsersRepository);

    sendEmailMock = jest
      .spyOn(EmailService.prototype, 'sendEmail')
      .mockResolvedValue() as jest.Mock<Promise<void>, [string, EmailTemplate]>;

    spy = jest.spyOn(cryptoService, 'generateUUID');
  });

  beforeEach(async () => {
    await appTestManager.cleanupDb(['schema_migrations']);

    sendEmailMock.mockClear();
    spy.mockClear();

    appTestManager.clearThrottlerStorage();
  });

  afterAll(async () => {
    await appTestManager.close();
  });

  it('should send the recovery code by email and save the recovery code and the date of the expiration to the database if the user has sent the correct data: (email address)', async () => {
    // 🔻 Создаём одного пользователя
    const [user]: UserViewDto[] = await usersTestManager.createUser(1);

    // 🔻 Отправляем POST-запрос на /auth/password-recovery с корректным email
    const resPasswordRecovery: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/password-recovery`)
      .send({
        email: user.email, // 🔸 Передаём email существующего пользователя
      })
      // 🔸 Ожидаем статус 204 No Content, потому что по контракту ответ без тела
      .expect(HttpStatus.NO_CONTENT);

    // 🔻 Получаем recoveryCode из мокнутого spy-функционала генератора кода
    const passwordRecovery: PasswordRecoveryDbType | null =
      await usersRepository.getPasswordRecoveryByRecoveryCode(spy.mock.results[0].value);

    // 🔸 Проверяем, что запись с таким recoveryCode найдена в базе
    expect(passwordRecovery).not.toBeNull();

    if (!passwordRecovery) {
      throw new Error(
        'Test №1: AuthController - newPassword() (POST: /auth/password-recovery): PasswordRecovery not found',
      );
    }

    // 🔸 Проверяем, что в базе сохранена корректная запись восстановления пароля
    expect(passwordRecovery).toEqual({
      userId: Number(user.id), // 🔸 ID пользователя совпадает
      recoveryCode: spy.mock.results[0].value, // 🔸 Код совпадает с тем, что был сгенерирован
      expirationDate: expect.any(Date), // 🔸 Дата истечения срока должна быть объектом Date
    });

    // 🔸 Убеждаемся, что email-отправка была вызвана
    expect(sendEmailMock).toHaveBeenCalled();
    expect(sendEmailMock).toHaveBeenCalledTimes(1);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resPasswordRecovery.body,
        resPasswordRecovery.statusCode,
        'Test №1: AuthController - passwordRecovery() (POST: /auth/password-recovery)',
      );
    }
  });

  it('should not send the password recovery code by email to the user if the user has sent more than 5 requests from one IP to "/password-recovery" in the last 10 seconds.', async () => {
    // 🔻 Создаём одного пользователя
    const [user]: UserViewDto[] = await usersTestManager.createUser(1);

    // 🔻 Делаем 5 корректных запросов на восстановление пароля с одного IP — лимит еще не превышен
    for (let i = 0; i < 5; i++) {
      await request(server)
        .post(`/${GLOBAL_PREFIX}/auth/password-recovery`)
        .send({
          email: user.email, // 🔸 Отправляем корректный email
        })
        // 🔸 Ожидаем статус 204 No Content — запросы пока укладываются в лимит
        .expect(HttpStatus.NO_CONTENT);
    }

    // 🔻 Выполняем 6-й запрос — он должен превысить лимит и быть отклонён
    const resPasswordRecovery: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/password-recovery`)
      .send({
        email: user.email, // 🔸 Всё ещё корректный email
      })
      // 🔸 Ожидаем статус 429 Too Many Requests — лимит превышен
      .expect(HttpStatus.TOO_MANY_REQUESTS);

    // 🔸 Проверяем, что sendEmailMock вызывался ровно 5 раз (только при первых 5 успешных попытках)
    expect(sendEmailMock).toHaveBeenCalledTimes(5);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resPasswordRecovery.body,
        resPasswordRecovery.statusCode,
        'Test №2: AuthController - passwordRecovery() (POST: /auth/password-recovery)',
      );
    }
  });

  it(
    'should not send the recovery code by e-mail and save the recovery code and expiration date in the database if' +
      ' the user has sent !!!INCORRECT!!! data: (email address)',
    async () => {
      // 🔻 Создаём одного пользователя (не важен, т.к. запрос будет с неправильным email)
      await usersTestManager.createUser(1);

      // 🔻 Отправляем POST-запрос на /auth/password-recovery с несуществующим email
      const resPasswordRecovery: Response = await request(server)
        .post(`/${GLOBAL_PREFIX}/auth/password-recovery`)
        .send({
          email: 'incorrect-email@example.com', // 🔸 Email не соответствует ни одному пользователю
        })
        // 🔸 Ожидаем статус 204 No Content — даже если email неверный, ответ без тела
        .expect(HttpStatus.NO_CONTENT);

      // 🔸 Убеждаемся, что мок отправки письма НЕ вызывался
      expect(sendEmailMock).toHaveBeenCalledTimes(0);

      if (testLoggingEnabled) {
        TestLoggers.logE2E(
          resPasswordRecovery.body,
          resPasswordRecovery.statusCode,
          'Test №3: AuthController - passwordRecovery() (POST: /auth/password-recovery)',
        );
      }
    },
  );

  it(
    'should not send the recovery code by e-mail and save the recovery code and expiration date in the database if' +
      ' the user has sent !!!INVALID!!! data: (email address)',
    async () => {
      // 🔻 Создаём одного пользователя
      await usersTestManager.createUser(1);

      // 🔻 Отправляем запрос на восстановление пароля с некорректным email-адресом
      const resPasswordRecovery: Response = await request(server)
        .post(`/${GLOBAL_PREFIX}/auth/password-recovery`)
        .send({
          email: 'invalid-email', // 🔸 Явно невалидный email (без "@", без домена и т.п.)
        })
        // 🔸 Ожидаем статус 400 Bad Request, так как данные не прошли валидацию
        .expect(HttpStatus.BAD_REQUEST);

      // 🔸 Проверяем структуру тела ответа — ожидаем сообщение об ошибке валидации по полю "email"
      expect(resPasswordRecovery.body).toEqual({
        errorsMessages: [
          {
            field: 'email',
            message:
              'email must match /^[\\w.-]+@([\\w-]+\\.)+[\\w-]{2,4}$/ regular expression; Received value: invalid-email',
          },
        ],
      });

      // 🔸 Проверяем, что функция отправки email НЕ вызывалась
      expect(sendEmailMock).toHaveBeenCalledTimes(0);

      if (testLoggingEnabled) {
        TestLoggers.logE2E(
          resPasswordRecovery.body,
          resPasswordRecovery.statusCode,
          'Test №4: AuthController - passwordRecovery() (POST: /auth/password-recovery)',
        );
      }
    },
  );
});
