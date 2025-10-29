import request, { Response } from 'supertest';
import { TestDtoFactory } from '../helpers/test.dto-factory';
import { UsersTestManager } from '../managers/users.test-manager';
import { GLOBAL_PREFIX } from '../../src/setup/global-prefix.setup';
import { TestLoggers } from '../helpers/test.loggers';
import { AppTestManager } from '../managers/app.test-manager';
import { AdminCredentials } from '../types';
import { Server } from 'http';
import { PaginatedViewDto } from '../../src/core/dto/paginated.view-dto';
import { EmailTemplate } from '../../src/modules/notifications/templates/types';
import { TestUtils } from '../helpers/test.utils';
import { HttpStatus } from '@nestjs/common';
import { EmailService } from '../../src/modules/notifications/services/email.service';
import { UserInputDto } from '../../src/modules/user-accounts/users/api/input-dto/user.input-dto';
import { UserViewDto } from '../../src/modules/user-accounts/users/api/view-dto/user.view-dto';

describe('AuthController - registration() (POST: /auth/registration)', () => {
  let appTestManager: AppTestManager;
  let usersTestManager: UsersTestManager;
  let adminCredentials: AdminCredentials;
  let adminCredentialsInBase64: string;
  let testLoggingEnabled: boolean;
  let server: Server;
  let sendEmailMock: jest.Mock;

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

    sendEmailMock = jest
      .spyOn(EmailService.prototype, 'sendEmail')
      .mockResolvedValue() as jest.Mock<Promise<void>, [string, EmailTemplate]>;
  });

  beforeEach(async () => {
    await appTestManager.cleanupDb(['migrations']);

    sendEmailMock.mockClear();

    appTestManager.clearThrottlerStorage();
  });

  afterAll(async () => {
    await appTestManager.close();
  });

  it('should be registered if the user has sent the correct data (login or email address and password).', async () => {
    // 🔻 Создаем тестовые данные для регистрации пользователя
    const [dto]: UserInputDto[] = TestDtoFactory.generateUserInputDto(1);

    // 🔻 Выполняем POST-запрос на регистрацию пользователя
    const resRegistration: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/registration`)
      .send(dto)
      .expect(HttpStatus.NO_CONTENT);

    // 🔻 Получаем созданного пользователя из базы данных
    const { items }: PaginatedViewDto<UserViewDto> = await usersTestManager.getAll();

    const [user] = items;

    if (!user) {
      throw new Error(
        'Test №1: AuthController - registration() (POST: /auth/registration): User not found',
      );
    }

    // 🔸 Проверяем количества созданных пользователей
    expect(items).toHaveLength(1);

    // 🔸 Проверяем корректность создания пользователя и его полей
    expect(typeof user.id).toBe('string');
    expect(new Date(user.createdAt).toString()).not.toBe('Invalid Date');
    expect(user.login).toBe(dto.login);
    expect(user.email).toBe(dto.email);

    // 🔸 Проверяем, что мок функция отправки email была вызвана корректно
    expect(sendEmailMock).toHaveBeenCalled();
    expect(sendEmailMock).toHaveBeenCalledTimes(1);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resRegistration.body,
        resRegistration.statusCode,
        'Test №1: AuthController - registration() (POST: /auth/registration)',
      );
    }
  });

  it('should not register the user in the system if the user has sent more than 5 requests from one IP to "/registration" in the last 10 seconds.', async () => {
    // 🔻 Создаем 6 наборов тестовых данных для регистрации
    const dtos: UserInputDto[] = TestDtoFactory.generateUserInputDto(6);

    // 🔻 Успешно регистрируем первых 5 пользователей
    for (let i = 0; i < 5; i++) {
      await request(server)
        .post(`/${GLOBAL_PREFIX}/auth/registration`)
        .send(dtos[i])
        .expect(HttpStatus.NO_CONTENT);
    }

    // 🔻 Пытаемся зарегистрировать 6-го пользователя и получаем ошибку ограничения
    const resRegistration: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/registration`)
      .send(dtos[5])
      .expect(HttpStatus.TOO_MANY_REQUESTS);

    // 🔻 Проверяем состояние базы данных после регистрации
    const { items }: PaginatedViewDto<UserViewDto> = await usersTestManager.getAll();

    // 🔸 Проверяем, что в базе данных ровно 5 пользователей
    expect(items).toHaveLength(5);

    // 🔸 Проверяем корректность вызовов отправки email
    expect(sendEmailMock).toHaveBeenCalled();
    expect(sendEmailMock).toHaveBeenCalledTimes(5);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resRegistration.body,
        resRegistration.statusCode,
        'Test №2: AuthController - registration() (POST: /auth/registration)',
      );
    }
  });

  it('should not be registered if a user with such data already exists (login).', async () => {
    // 🔻 Создаем пользователя через менеджер
    const [user]: UserViewDto[] = await usersTestManager.createUser(1);

    // 🔻 Пытаемся зарегистрировать нового пользователя с тем же логином
    const resRegistration: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/registration`)
      .send({
        login: user.login,
        email: 'newUser@example.com',
        password: 'qwerty',
      })
      .expect(HttpStatus.BAD_REQUEST);

    // 🔸 Проверяем корректность возвращаемой ошибки
    expect(resRegistration.body).toEqual({
      errorsMessages: [
        {
          message: 'User with the same login already exists.',
          field: 'login',
        },
      ],
    });

    // 🔻 Проверяем, что в базе данных изменений не произошло
    const { items }: PaginatedViewDto<UserViewDto> = await usersTestManager.getAll();
    expect(items).toHaveLength(1);

    // 🔸 Проверяем, что email не был отправлен
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(sendEmailMock).toHaveBeenCalledTimes(0);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resRegistration.body,
        resRegistration.statusCode,
        'Test №3: AuthController - registration() (POST: /auth/registration)',
      );
    }
  });

  it('should not be registered if a user with such data already exists (email).', async () => {
    // 🔻 Создаем пользователя через менеджер
    const [user]: UserViewDto[] = await usersTestManager.createUser(1);

    // 🔻 Пытаемся зарегистрировать нового пользователя с тем же email
    const resRegistration: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/registration`)
      .send({
        login: 'newUser',
        email: user.email,
        password: 'qwerty',
      })
      .expect(HttpStatus.BAD_REQUEST);

    // 🔸 Проверяем корректность возвращаемой ошибки
    expect(resRegistration.body).toEqual({
      errorsMessages: [
        {
          message: 'User with the same email already exists.',
          field: 'email',
        },
      ],
    });

    // 🔻 Проверяем, что в базе данных изменений не произошло
    const { items }: PaginatedViewDto<UserViewDto> = await usersTestManager.getAll();
    expect(items).toHaveLength(1);

    // 🔸 Проверяем, что email не был отправлен
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(sendEmailMock).toHaveBeenCalledTimes(0);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resRegistration.body,
        resRegistration.statusCode,
        'Test №4: AuthController - registration() (POST: /auth/registration)',
      );
    }
  });

  it('should not be registered a user if the data in the request body is incorrect (an empty object is passed).', async () => {
    // 🔻 Пытаемся зарегистрировать пользователя без каких-либо данных
    const resRegistration: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/registration`)
      .send({})
      .expect(HttpStatus.BAD_REQUEST);

    // 🔸 Проверяем корректность возвращаемых ошибок валидации
    expect(resRegistration.body).toEqual({
      errorsMessages: [
        {
          field: 'password',
          message: 'password must be a string; Received value: undefined',
        },
        {
          field: 'email',
          message:
            'email must match /^[\\w.-]+@([\\w-]+\\.)+[\\w-]{2,4}$/ regular expression; Received value: undefined',
        },
        {
          field: 'login',
          message: 'login must be a string; Received value: undefined',
        },
      ],
    });

    // 🔻 Проверяем, что в базе данных нет созданных пользователей
    const { items }: PaginatedViewDto<UserViewDto> = await usersTestManager.getAll();
    expect(items).toHaveLength(0);

    // 🔸 Проверяем, что email не был отправлен
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(sendEmailMock).toHaveBeenCalledTimes(0);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resRegistration.body,
        resRegistration.statusCode,
        'Test №5: AuthController - registration() (POST: /auth/registration)',
      );
    }
  });

  it('should not be registered a user if the data in the request body is incorrect (login: empty line, email: empty line, password: empty line).', async () => {
    // 🔻 Пытаемся зарегистрировать пользователя с пустыми (пробельными) значениями полей
    const resRegistration: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/registration`)
      .send({
        login: '   ',
        email: '   ',
        password: '   ',
      })
      .expect(HttpStatus.BAD_REQUEST);

    // 🔸 Проверяем корректность возвращаемых ошибок валидации для пустых значений
    expect(resRegistration.body).toEqual({
      errorsMessages: [
        {
          field: 'password',
          message: 'password must be longer than or equal to 6 characters; Received value: ',
        },
        {
          field: 'email',
          message:
            'email must match /^[\\w.-]+@([\\w-]+\\.)+[\\w-]{2,4}$/ regular expression; Received value: ',
        },
        {
          field: 'login',
          message: 'login must be longer than or equal to 3 characters; Received value: ',
        },
      ],
    });

    // 🔻 Проверяем, что в базе данных нет созданных пользователей
    const { items }: PaginatedViewDto<UserViewDto> = await usersTestManager.getAll();
    expect(items).toHaveLength(0);

    // 🔸 Проверяем, что email не был отправлен
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(sendEmailMock).toHaveBeenCalledTimes(0);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resRegistration.body,
        resRegistration.statusCode,
        'Test №6: AuthController - registration() (POST: /auth/registration)',
      );
    }
  });

  it('should not be registered a user if the data in the request body is incorrect (login: less than the minimum length, email: incorrect, password: less than the minimum length).', async () => {
    // 🔻 Генерируем случайные значения для полей регистрации, которые не соответствуют требованиям
    const login: string = TestUtils.generateRandomString(2);
    const email: string = TestUtils.generateRandomString(10);
    const password: string = TestUtils.generateRandomString(5);

    // 🔻 Пытаемся зарегистрировать пользователя с некорректными данными
    const resRegistration: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/registration`)
      .send({
        login,
        email,
        password,
      })
      .expect(HttpStatus.BAD_REQUEST);

    // 🔸 Проверяем корректность возвращаемых ошибок валидации с конкретными значениями
    expect(resRegistration.body).toEqual({
      errorsMessages: [
        {
          field: 'password',
          message: `password must be longer than or equal to 6 characters; Received value: ${password}`,
        },
        {
          field: 'email',
          message: `email must match /^[\\w.-]+@([\\w-]+\\.)+[\\w-]{2,4}$/ regular expression; Received value: ${email}`,
        },
        {
          field: 'login',
          message: `login must be longer than or equal to 3 characters; Received value: ${login}`,
        },
      ],
    });

    // 🔻 Проверяем, что в базе данных нет созданных пользователей
    const { items }: PaginatedViewDto<UserViewDto> = await usersTestManager.getAll();
    expect(items).toHaveLength(0);

    // 🔸 Проверяем, что email не был отправлен
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(sendEmailMock).toHaveBeenCalledTimes(0);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resRegistration.body,
        resRegistration.statusCode,
        'Test №7: AuthController - registration() (POST: /auth/registration)',
      );
    }
  });

  it('should not be registered a user if the data in the request body is incorrect (login: exceeds max length,  email: incorrect, password: exceeds max length).', async () => {
    // 🔻 Генерируем случайные значения для полей регистрации, которые превышают максимально допустимую длину
    const login: string = TestUtils.generateRandomString(11);
    const email: string = TestUtils.generateRandomString(10);
    const password: string = TestUtils.generateRandomString(21);

    // 🔻 Пытаемся зарегистрировать пользователя с некорректными данными
    const resRegistration: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/registration`)
      .send({
        login,
        email,
        password,
      })
      .expect(HttpStatus.BAD_REQUEST);

    // 🔸 Проверяем корректность возвращаемых ошибок валидации с конкретными значениями
    expect(resRegistration.body).toEqual({
      errorsMessages: [
        {
          field: 'password',
          message: `password must be shorter than or equal to 20 characters; Received value: ${password}`,
        },
        {
          field: 'email',
          message: `email must match /^[\\w.-]+@([\\w-]+\\.)+[\\w-]{2,4}$/ regular expression; Received value: ${email}`,
        },
        {
          field: 'login',
          message: `login must be shorter than or equal to 10 characters; Received value: ${login}`,
        },
      ],
    });

    // 🔻 Проверяем, что в базе данных нет созданных пользователей
    const { items }: PaginatedViewDto<UserViewDto> = await usersTestManager.getAll();
    expect(items).toHaveLength(0);

    // 🔸 Проверяем, что email не был отправлен
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(sendEmailMock).toHaveBeenCalledTimes(0);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resRegistration.body,
        resRegistration.statusCode,
        'Test №8: AuthController - registration() (POST: /auth/registration)',
      );
    }
  });

  it('should not be registered a user if the data in the request body is incorrect (login: type number,  email: type number, password: type number).', async () => {
    // 🔻 Пытаемся зарегистрировать пользователя, передавая числовые значения вместо строк
    const resRegistration: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/registration`)
      .send({
        login: 123,
        email: 123,
        password: 123,
      })
      .expect(HttpStatus.BAD_REQUEST);

    // 🔸 Проверяем корректность возвращаемых ошибок валидации типов данных
    expect(resRegistration.body).toEqual({
      errorsMessages: [
        {
          field: 'password',
          message: 'password must be a string; Received value: 123',
        },
        {
          field: 'email',
          message:
            'email must match /^[\\w.-]+@([\\w-]+\\.)+[\\w-]{2,4}$/ regular expression; Received value: 123',
        },
        {
          field: 'login',
          message: 'login must be a string; Received value: 123',
        },
      ],
    });

    // 🔻 Проверяем, что в базе данных нет созданных пользователей
    const { items }: PaginatedViewDto<UserViewDto> = await usersTestManager.getAll();
    expect(items).toHaveLength(0);

    // 🔸 Проверяем, что email не был отправлен
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(sendEmailMock).toHaveBeenCalledTimes(0);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resRegistration.body,
        resRegistration.statusCode,
        'Test №9: AuthController - registration() (POST: /auth/registration)',
      );
    }
  });
});
