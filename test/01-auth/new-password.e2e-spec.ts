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
import { UserDbType } from '../../src/modules/user-accounts/users/types/user-db.type';
import { CryptoService } from '../../src/modules/user-accounts/users/application/services/crypto.service';
import SpyInstance = jest.SpyInstance;
import { PasswordRecoveryDbType } from '../../src/modules/user-accounts/auth/types/password-recovery-db.type';

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
    await appTestManager.cleanupDb(['schema_migrations']);

    sendEmailMock.mockClear();
    spy.mockClear();

    appTestManager.clearThrottlerStorage();
  });

  afterAll(async () => {
    await appTestManager.close();
  });

  it('should update the password if the user has sent the correct data: (newPassword, recoveryCode)', async () => {
    // 🔻 Создаём одного пользователя
    const [user]: UserViewDto[] = await usersTestManager.createUser(1);

    // 🔻 Запрашиваем восстановление пароля для этого пользователя (имитация запроса от пользователя)
    await usersTestManager.passwordRecovery(user.email);

    // 🔻 Получаем пользователя из базы до изменения пароля, чтобы позже сравнить hash
    const userWithOldPassword: UserDbType | null =
      await usersRepository.getByEmail(user.email);

    expect(userWithOldPassword).not.toBeNull();

    // 🔸 Если пользователь не найден — бросаем исключение, чтобы прекратить тест
    if (!userWithOldPassword) {
      throw new Error(
        'Test №1: AuthController - newPassword() (POST: /auth/new-password): User not found',
      );
    }

    // 🔻 Получаем запись восстановления по коду из email-отправки (взятый из mock-а)
    const passwordRecovery_1: PasswordRecoveryDbType | null =
      await usersRepository.getPasswordRecoveryByRecoveryCode(
        spy.mock.results[0].value,
      );

    expect(passwordRecovery_1).not.toBeNull();

    // 🔸 Если запись восстановления не найдена — это ошибка
    if (!passwordRecovery_1) {
      throw new Error(
        'Test №1: AuthController - newPassword() (POST: /auth/new-password): passwordRecovery_1 not found',
      );
    }

    // 🔸 Убеждаемся, что запись восстановления содержит корректные данные
    expect(passwordRecovery_1).toEqual({
      userId: userWithOldPassword.id,
      recoveryCode: spy.mock.results[0].value,
      expirationDate: expect.any(Date),
    });

    // 🔻 Отправляем запрос на установку нового пароля
    const resNewPassword: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/new-password`)
      .send({
        newPassword: 'qwerty', // 🔸 Новый пароль
        recoveryCode: spy.mock.results[0].value, // 🔸 Корректный recovery code из мока
      })
      // 🔸 Ожидаем статус 204 No Content — обновление пароля прошло успешно
      .expect(HttpStatus.NO_CONTENT);

    // 🔻 Получаем пользователя повторно после изменения пароля
    const userWithNewPassword: UserDbType | null =
      await usersRepository.getByEmail(user.email);

    expect(userWithNewPassword).not.toBeNull();

    // 🔸 Если не найден — ошибка
    if (!userWithNewPassword) {
      throw new Error(
        'Test №1: AuthController - newPassword() (POST: /auth/new-password): User not found',
      );
    }

    // 🔸 Проверяем, что хэш пароля действительно изменился
    expect(userWithOldPassword.passwordHash).not.toBe(
      userWithNewPassword.passwordHash,
    );

    // 🔻 Проверяем, что recovery-код удалён из базы после успешного изменения пароля
    const passwordRecovery_2: PasswordRecoveryDbType | null =
      await usersRepository.getPasswordRecoveryByRecoveryCode(
        spy.mock.results[0].value,
      );

    // 🔸 Запись должна быть удалена — возврат null
    expect(passwordRecovery_2).toBeNull();

    // 🔸 Проверяем, что письмо действительно было отправлено
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
  //TODO: как правильно написать тест на rate limit

  it('should not update the password if the user has sent incorrect data: (newPassword: less than 6 characters)', async () => {
    // 🔻 Создаём одного пользователя;
    const [user]: UserViewDto[] = await usersTestManager.createUser(1);

    // 🔻 Запрашиваем восстановление пароля, чтобы в базу записался recoveryCode
    await usersTestManager.passwordRecovery(user.email);

    // 🔻 Получаем пользователя из базы до изменения пароля
    const found_user_1: UserDbType | null = await usersRepository.getByEmail(
      user.email,
    );

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
        newPassword: 'qwert', // 🔸 Некорректный пароль
        recoveryCode: spy.mock.results[0].value, // 🔸 Валидный recoveryCode
      })
      .expect(HttpStatus.BAD_REQUEST); // 🔸 Ожидаем 400 Bad Request

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
    const found_user_2: UserDbType | null = await usersRepository.getByEmail(
      user.email,
    );

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
    const [user]: UserViewDto[] = await usersTestManager.createUser(1);

    // 🔻 Генерируем некорректный пароль (длиной более 20 символов)
    const invalidPassword: string = TestUtils.generateRandomString(21);

    // 🔻 Инициируем восстановление пароля (отправка кода на email)
    await usersTestManager.passwordRecovery(user.email);

    // 🔻 Получаем пользователя из базы данных (до попытки смены пароля)
    const found_user_1: UserDbType | null = await usersRepository.getByEmail(
      user.email,
    );

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
        recoveryCode: spy.mock.results[0].value, // 🔸 Используем ранее сгенерированный recoveryCode
      })
      .expect(HttpStatus.BAD_REQUEST); // 🔸 Ожидаем статус 400 (BAD_REQUEST)

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
    const found_user_2: UserDbType | null = await usersRepository.getByEmail(
      user.email,
    );

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
    const found_user_1: UserDbType | null = await usersRepository.getByEmail(
      user.email,
    );

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
        recoveryCode: 'incorrect-recovery-code', // 🔸 Неверный код восстановления
      })
      .expect(HttpStatus.BAD_REQUEST); // 🔸 Ожидаем 400, т.к. recoveryCode некорректный

    // 🔻 Повторно получаем пользователя из базы данных после запроса на смену пароля
    const found_user_2: UserDbType | null = await usersRepository.getByEmail(
      user.email,
    );

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
