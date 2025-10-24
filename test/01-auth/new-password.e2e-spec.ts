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
import { User } from '../../src/modules/user-accounts/users/domain/entities/user.entity';
import SpyInstance = jest.SpyInstance;

describe('AuthController - newPassword() (POST: /auth/new-password)', () => {
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

    usersTestManager = new UsersTestManager(server, adminCredentialsInBase64);
    usersRepository = appTestManager.app.get(UsersRepository);
    cryptoService = appTestManager.app.get(CryptoService);
    testLoggingEnabled = appTestManager.coreConfig.testLoggingEnabled;

    sendEmailMock = jest
      .spyOn(EmailService.prototype, 'sendEmail')
      .mockResolvedValue() as jest.Mock<Promise<void>, [string, EmailTemplate]>;

    spy = jest.spyOn(cryptoService, 'generateUUID');
  });

  beforeEach(async () => {
    await appTestManager.cleanupDb(['migrations']);

    sendEmailMock.mockClear();
    spy.mockClear();

    appTestManager.clearThrottlerStorage();
  });

  afterAll(async () => {
    await appTestManager.close();
  });

  it('should update the password if the user has sent the correct data: (newPassword, recoveryCode)', async () => {
    // 🔻 Создаём пользователя и очищаем мок шпиона перед тестом
    const [createdUser]: UserViewDto[] = await usersTestManager.createUser(1);
    spy.mockClear();

    // 🔻 Инициируем процесс восстановления пароля, который генерирует recoveryCode
    await usersTestManager.passwordRecovery(createdUser.email);

    // 🔻 Получаем пользователя из БД вместе с recoveryCode до смены пароля
    const userWithOldPassword: User | null =
      await usersRepository.getByEmailWithPasswordRecoveryCode(createdUser.email);

    expect(userWithOldPassword).not.toBeNull();

    if (!userWithOldPassword) {
      throw new Error(
        'Test №1: AuthController - newPassword() (POST: /auth/new-password): User not found',
      );
    }

    // 🔻 Проверяем наличие recoveryCode и даты истечения
    expect(userWithOldPassword.passwordRecoveryCode).toMatchObject({
      recoveryCode: spy.mock.results[0].value,
      expirationDate: expect.any(Date),
    });

    // 🔻 Отправляем POST-запрос на обновление пароля с новым паролем и recoveryCode, ожидаем 204 No Content
    const resNewPassword: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/new-password`)
      .send({
        newPassword: 'qwerty',
        recoveryCode: spy.mock.results[0].value,
      })
      .expect(HttpStatus.NO_CONTENT);

    // 🔻 Получаем пользователя заново из БД после смены пароля
    const userWithNewPassword: User | null =
      await usersRepository.getByEmailWithPasswordRecoveryCode(createdUser.email);

    expect(userWithNewPassword).not.toBeNull();

    if (!userWithNewPassword) {
      throw new Error(
        'Test №1: AuthController - newPassword() (POST: /auth/new-password): User not found',
      );
    }

    // 🔻 Проверяем, что хэш пароля изменился
    expect(userWithOldPassword.passwordHash).not.toBe(userWithNewPassword.passwordHash);

    // 🔻 Проверяем, что recoveryCode сброшен
    expect(userWithNewPassword.passwordRecoveryCode).toMatchObject({
      recoveryCode: null,
      expirationDate: null,
    });

    // 🔻 Проверяем, что письмо было отправлено один раз
    expect(sendEmailMock).toHaveBeenCalled();
    expect(sendEmailMock).toHaveBeenCalledTimes(1);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resNewPassword.body,
        resNewPassword.statusCode,
        'Test №1: AuthController - newPassword() (POST: /auth/new-password)',
      );
    }
  });

  it('should update the password if the user has sent the correct data: (newPassword, recoveryCode)', async () => {
    // 🔻 Создаём одного пользователя
    const [createdUser]: UserViewDto[] = await usersTestManager.createUser(1);

    // 🔻 Отправляем запрос на восстановление пароля — в этот момент срабатывает шпион spy на отправку кода
    await usersTestManager.passwordRecovery(createdUser.email);

    // 🔻 Отправляем 5 подряд запросов на смену пароля с валидным recoveryCode, чтобы превысить лимит
    for (let i = 0; i < 5; i++) {
      await request(server).post(`/${GLOBAL_PREFIX}/auth/new-password`).send({
        newPassword: 'qwerty',
        recoveryCode: spy.mock.results[0].value,
      });
    }

    // 🔻 Пытаемся отправить 6-й запрос — ожидаем ограничение по частоте (rate limit)
    const resNewPassword: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/new-password`)
      .send({
        newPassword: 'qwerty',
        recoveryCode: spy.mock.results[0].value,
      })
      .expect(HttpStatus.TOO_MANY_REQUESTS);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resNewPassword.body,
        resNewPassword.statusCode,
        'Test №2: AuthController - newPassword() (POST: /auth/new-password)',
      );
    }
  });

  it('should not update the password if the user has sent incorrect data: (newPassword: less than 6 characters)', async () => {
    // 🔻 Создаём одного пользователя;
    const [createdUser]: UserViewDto[] = await usersTestManager.createUser(1);
    spy.mockClear();

    // 🔻 Запрашиваем восстановление пароля, чтобы в базу записался recoveryCode
    await usersTestManager.passwordRecovery(createdUser.email);

    // 🔻 Получаем пользователя из базы до изменения пароля
    const found_user_1: User | null = await usersRepository.getByEmail(createdUser.email);

    // 🔸 Проверяем, что пользователь найден
    expect(found_user_1).not.toBeNull();

    if (!found_user_1) {
      throw new Error(
        'Test №3: AuthController - newPassword() (POST: /auth/new-password): User not found',
      );
    }

    // 🔻 Пытаемся отправить некорректный новый пароль (меньше 6 символов)
    const resNewPassword: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/new-password`)
      .send({
        newPassword: 'qwert',
        recoveryCode: spy.mock.results[0].value,
      })
      .expect(HttpStatus.BAD_REQUEST);

    // 🔸 Проверяем тело ответа: должна быть ошибка валидации по полю newPassword
    expect(resNewPassword.body).toEqual({
      errorsMessages: [
        {
          field: 'newPassword',
          message:
            'newPassword must be longer than or equal to 6 characters; Received value: qwert',
        },
      ],
    });

    // 🔻 Получаем пользователя из базы после запроса на смену пароля
    const found_user_2: User | null = await usersRepository.getByEmail(createdUser.email);

    // 🔸 Проверяем, что пользователь всё ещё существует
    expect(found_user_2).not.toBeNull();

    if (!found_user_2) {
      throw new Error(
        'Test №3: AuthController - newPassword() (POST: /auth/new-password): User not found',
      );
    }

    // 🔸 Проверяем, что хэш пароля остался прежним (пароль не обновлён)
    expect(found_user_1.passwordHash).toBe(found_user_2.passwordHash);

    // 🔸 Проверяем, что письмо всё ещё было отправлено (на этапе recovery)
    expect(sendEmailMock).toHaveBeenCalled();
    expect(sendEmailMock).toHaveBeenCalledTimes(1);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resNewPassword.body,
        resNewPassword.statusCode,
        'Test №3: AuthController - newPassword() (POST: /auth/new-password)',
      );
    }
  });

  it('should not update the password if the user has sent incorrect data: (newPassword: more than 20 characters)', async () => {
    // 🔻 Создаём одного пользователя
    const [createdUser]: UserViewDto[] = await usersTestManager.createUser(1);

    // 🔻 Генерируем некорректный пароль (длиной более 20 символов)
    const invalidPassword: string = TestUtils.generateRandomString(21);

    // 🔻 Инициируем восстановление пароля (отправка кода на email)
    await usersTestManager.passwordRecovery(createdUser.email);

    // 🔻 Получаем пользователя из базы данных (до попытки смены пароля)
    const found_user_1: User | null = await usersRepository.getByEmail(createdUser.email);

    // 🔸 Проверяем, что пользователь действительно существует
    expect(found_user_1).not.toBeNull();
    if (!found_user_1) {
      throw new Error(
        'Test №4: AuthController - newPassword() (POST: /auth/new-password): User not found',
      );
    }

    // 🔻 Отправляем POST-запрос на смену пароля с некорректным (слишком длинным) паролем
    const resNewPassword: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/new-password`)
      .send({
        newPassword: invalidPassword,
        recoveryCode: spy.mock.results[0].value,
      })
      .expect(HttpStatus.BAD_REQUEST);

    // 🔸 Проверяем, что тело ответа содержит ожидаемое сообщение об ошибке
    expect(resNewPassword.body).toEqual({
      errorsMessages: [
        {
          field: 'newPassword',
          message: `newPassword must be shorter than or equal to 20 characters; Received value: ${invalidPassword}`,
        },
      ],
    });

    // 🔻 Получаем пользователя из базы данных повторно (после запроса на смену пароля)
    const found_user_2: User | null = await usersRepository.getByEmail(createdUser.email);

    // 🔸 Проверяем, что пользователь всё ещё существует
    expect(found_user_2).not.toBeNull();
    if (!found_user_2) {
      throw new Error(
        'Test №4: AuthController - newPassword() (POST: /auth/new-password): User not found',
      );
    }

    // 🔸 Проверяем, что хеш пароля не изменился (т.е. пароль не был обновлён)
    expect(found_user_1.passwordHash).toBe(found_user_2.passwordHash);

    // 🔻 Проверяем, что письмо было отправлено только один раз (на этапе восстановления)
    expect(sendEmailMock).toHaveBeenCalled();
    expect(sendEmailMock).toHaveBeenCalledTimes(1);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resNewPassword.body,
        resNewPassword.statusCode,
        'Test №4: AuthController - newPassword() (POST: /auth/new-password)',
      );
    }
  });

  it('should not update the password if the user has sent incorrect data: (recoveryCode)', async () => {
    // 🔻 Создаём одного пользователя через test manager
    const [user]: UserViewDto[] = await usersTestManager.createUser(1);

    // 🔻 Отправляем запрос на восстановление пароля, чтобы сгенерировать recoveryCode
    await usersTestManager.passwordRecovery(user.email);

    // 🔻 Получаем пользователя из базы данных перед изменением пароля
    const found_user_1: User | null = await usersRepository.getByEmail(user.email);

    // 🔸 Убеждаемся, что пользователь существует
    expect(found_user_1).not.toBeNull();

    if (!found_user_1) {
      throw new Error(
        'Test №5: AuthController - newPassword() (POST: /auth/new-password): User not found',
      );
    }

    // 🔻 Отправляем запрос на изменение пароля с НЕВЕРНЫМ recoveryCode
    const resNewPassword: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/new-password`)
      .send({
        newPassword: 'qwerty',
        recoveryCode: 'incorrect-recovery-code',
      })
      .expect(HttpStatus.BAD_REQUEST);

    // 🔻 Повторно получаем пользователя из базы данных после запроса на смену пароля
    const found_user_2: User | null = await usersRepository.getByEmail(user.email);

    // 🔸 Убеждаемся, что пользователь существует
    expect(found_user_2).not.toBeNull();

    if (!found_user_2) {
      throw new Error(
        'Test №5: AuthController - newPassword() (POST: /auth/new-password): User not found',
      );
    }

    // 🔸 Убеждаемся, что пароль не изменился (hash остался тем же)
    expect(found_user_1.passwordHash).toBe(found_user_2.passwordHash);

    // 🔸 Проверяем, что письмо отправлено
    expect(sendEmailMock).toHaveBeenCalled();
    expect(sendEmailMock).toHaveBeenCalledTimes(1);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resNewPassword.body,
        resNewPassword.statusCode,
        'Test №5: AuthController - newPassword() (POST: /auth/new-password)',
      );
    }
  });
});
