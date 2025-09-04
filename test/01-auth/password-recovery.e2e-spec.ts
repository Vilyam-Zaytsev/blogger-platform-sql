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
import SpyInstance = jest.SpyInstance;
import { User } from '../../src/modules/user-accounts/users/domain/entities/user.entity';

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
    // 🔻 Создаём пользователя и очищаем мок шпиона перед тестом
    const [createdUser]: UserViewDto[] = await usersTestManager.createUser(1);
    spy.mockClear();

    // 🔻 Отправляем POST-запрос на восстановление пароля с email пользователя, ожидаем 204 No Content
    const resPasswordRecovery: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/password-recovery`)
      .send({
        email: createdUser.email,
      })
      .expect(HttpStatus.NO_CONTENT);

    // 🔻 Получаем пользователя из БД по коду восстановления, сгенерированному моком
    const user: User | null = await usersRepository.getByPasswordRecoveryCode(
      spy.mock.results[0].value,
    );
    expect(user).not.toBeNull();

    if (!user) {
      throw new Error(
        'Test №1: AuthController - registrationConfirmation() (POST: /auth/registration-confirmation): User not found',
      );
    }

    // 🔻 Проверяем, что у пользователя сохранён recoveryCode и дата истечения срока действия
    expect(user.passwordRecoveryCode).toMatchObject({
      recoveryCode: spy.mock.results[0].value,
      expirationDate: expect.any(Date),
    });

    // 🔻 Проверяем, что письмо было отправлено ровно один раз
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
          email: user.email,
        })
        .expect(HttpStatus.NO_CONTENT);
    }

    // 🔻 Выполняем 6-й запрос — он должен превысить лимит и быть отклонён
    const resPasswordRecovery: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/password-recovery`)
      .send({
        email: user.email,
      })
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
          email: 'invalid-email',
        })
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
