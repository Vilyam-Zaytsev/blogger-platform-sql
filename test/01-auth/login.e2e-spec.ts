import request, { Response } from 'supertest';
import { UsersTestManager } from '../managers/users.test-manager';
import { GLOBAL_PREFIX } from '../../src/setup/global-prefix.setup';
import { TestLoggers } from '../helpers/test.loggers';
import { AppTestManager } from '../managers/app.test-manager';
import { AdminCredentials } from '../types';
import { Server } from 'http';
import { TestUtils } from '../helpers/test.utils';
import { HttpStatus } from '@nestjs/common';
import { UserViewDto } from '../../src/modules/user-accounts/users/api/view-dto/user.view-dto';

describe('AuthController - login() (POST: /auth/login)', () => {
  let appTestManager: AppTestManager;
  let usersTestManager: UsersTestManager;
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

    usersTestManager = new UsersTestManager(server, adminCredentialsInBase64);
  });

  beforeEach(async () => {
    await appTestManager.cleanupDb(['schema_migrations']);

    appTestManager.clearThrottlerStorage();
  });

  afterAll(async () => {
    await appTestManager.close();
  });

  it('should be authorized if the user has sent the correct data (loginOrEmail and password)', async () => {
    // 🔻 Создаём нового пользователя с подтверждённым email
    const [user]: UserViewDto[] = await usersTestManager.createUser(1);

    // 🔻 Отправляем корректные логин/пароль в запросе на вход
    const resLogin: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/login`)
      .send({
        loginOrEmail: user.login,
        password: 'qwerty',
      })
      .expect(HttpStatus.OK);

    // 🔸 Проверяем, что в ответе пришёл accessToken
    expect(resLogin.body).toEqual({
      accessToken: expect.any(String),
    });

    // 🔸 Убеждаемся, что в заголовке Set-Cookie содержится refreshToken
    expect(resLogin.headers['set-cookie']).toBeDefined();
    expect(resLogin.headers['set-cookie'][0]).toMatch(/refreshToken=.*;/);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resLogin.body,
        resLogin.statusCode,
        'Test №1: AuthController - login() (POST: /auth/login)',
      );
    }
  });

  it('should not log in if the user has sent more than 5 requests from one IP to "/login" in the last 10 seconds.', async () => {
    // 🔻 Создаём пользователя
    const [createdUser]: UserViewDto[] = await usersTestManager.createUser(1);

    // 🔸 Отправляем 5 корректных запросов на вход — все они должны пройти успешно
    for (let i = 0; i < 5; i++) {
      await request(server)
        .post(`/${GLOBAL_PREFIX}/auth/login`)
        .send({
          loginOrEmail: createdUser.login,
          password: 'qwerty',
        })
        .expect(HttpStatus.OK);
    }

    // 🔸 6-й запрос должен быть заблокирован из-за превышения лимита
    const resLogin: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/login`)
      .send({
        loginOrEmail: createdUser.login,
        password: 'qwerty',
      })
      .expect(HttpStatus.TOO_MANY_REQUESTS);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resLogin.body,
        resLogin.statusCode,
        'Test №2: AuthController - login() (POST: /auth/login)',
      );
    }
  });

  it('should not log in if the user has sent invalid data (loginOrEmail: "undefined", password: "undefined")', async () => {
    // 🔻 Выполняем POST-запрос на /auth/login с пустым телом
    const resLogin: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/login`)
      .send({})
      .expect(HttpStatus.BAD_REQUEST);

    // 🔸 Проверяем тело ответа с ошибками валидации по полям loginOrEmail и password
    expect(resLogin.body).toEqual({
      errorsMessages: [
        {
          field: 'password',
          message: 'password must be a string; Received value: undefined',
        },
        {
          field: 'loginOrEmail',
          message: 'loginOrEmail must be a string; Received value: undefined',
        },
      ],
    });

    // 🔸 Убеждаемся, что cookie не установлен
    expect(resLogin.headers['set-cookie']).toBeUndefined();

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resLogin.body,
        resLogin.statusCode,
        'Test №3: AuthController - login() (POST: /auth/login)',
      );
    }
  });

  it('should not log in if the user has sent invalid data (loginOrEmail: type number, password: type number)', async () => {
    // 🔻 Выполняем POST-запрос на /auth/login с числовыми значениями loginOrEmail и password
    const resLogin: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/login`)
      .send({
        loginOrEmail: 123,
        password: 123,
      })
      .expect(HttpStatus.BAD_REQUEST);

    // 🔸 Проверяем тело ответа с ошибками валидации по полям loginOrEmail и password
    expect(resLogin.body).toEqual({
      errorsMessages: [
        {
          field: 'password',
          message: 'password must be a string; Received value: 123',
        },
        {
          field: 'loginOrEmail',
          message: 'loginOrEmail must be a string; Received value: 123',
        },
      ],
    });

    // 🔸 Убеждаемся, что cookie не установлен
    expect(resLogin.headers['set-cookie']).toBeUndefined();

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resLogin.body,
        resLogin.statusCode,
        'Test №4: AuthController - login() (POST: /auth/login)',
      );
    }
  });

  it('should not log in if the user has sent invalid data (loginOrEmail: empty line, password: empty line)', async () => {
    // 🔻 Выполняем POST-запрос на /auth/login с пустыми строками в полях loginOrEmail и password
    const resLogin: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/login`)
      .send({
        loginOrEmail: '   ',
        password: '   ',
      })
      .expect(HttpStatus.BAD_REQUEST);

    // 🔸 Проверяем тело ответа с ошибками валидации по длине строк в loginOrEmail и password
    expect(resLogin.body).toEqual({
      errorsMessages: [
        {
          field: 'password',
          message: 'password must be longer than or equal to 6 characters; Received value: ',
        },
        {
          field: 'loginOrEmail',
          message: 'loginOrEmail must be longer than or equal to 3 characters; Received value: ',
        },
      ],
    });

    // 🔸 Убеждаемся, что cookie не установлен
    expect(resLogin.headers['set-cookie']).toBeUndefined();

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resLogin.body,
        resLogin.statusCode,
        'Test №5: AuthController - login() (POST: /auth/login)',
      );
    }
  });

  it('should not log in if the user has sent invalid data (loginOrEmail: exceeds max length, password: exceeds max length)', async () => {
    // 🔻 Выполняем POST-запрос на /auth/login с loginOrEmail (101 символ) и password (21 символ), превышающими максимальную длину
    const loginOrEmail: string = TestUtils.generateRandomString(101);
    const password: string = TestUtils.generateRandomString(21);

    const resLogin: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/login`)
      .send({
        loginOrEmail,
        password,
      })
      .expect(HttpStatus.BAD_REQUEST);

    // 🔸 Проверяем тело ответа с ошибками валидации по максимальной длине loginOrEmail и password
    expect(resLogin.body).toEqual({
      errorsMessages: [
        {
          field: 'password',
          message: `password must be shorter than or equal to 20 characters; Received value: ${password}`,
        },
        {
          field: 'loginOrEmail',
          message: `loginOrEmail must be shorter than or equal to 100 characters; Received value: ${loginOrEmail}`,
        },
      ],
    });

    // 🔸 Убеждаемся, что cookie не установлен
    expect(resLogin.headers['set-cookie']).toBeUndefined();

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resLogin.body,
        resLogin.statusCode,
        'Test №6: AuthController - login() (POST: /auth/login)',
      );
    }
  });

  it('should not log in if the user has sent incorrect data (loginOrEmail: exceeds the minimum length)', async () => {
    // 🔻 Выполняем POST-запрос на /auth/login с loginOrEmail (2 символа) и password (5 символов), не удовлетворяющими минимальной длине
    const loginOrEmail: string = TestUtils.generateRandomString(2);
    const password: string = TestUtils.generateRandomString(5);

    const resLogin: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/login`)
      .send({
        loginOrEmail,
        password,
      })
      .expect(HttpStatus.BAD_REQUEST);

    // 🔸 Проверяем тело ответа с ошибками валидации по минимальной длине loginOrEmail и password
    expect(resLogin.body).toEqual({
      errorsMessages: [
        {
          field: 'password',
          message: `password must be longer than or equal to 6 characters; Received value: ${password}`,
        },
        {
          field: 'loginOrEmail',
          message: `loginOrEmail must be longer than or equal to 3 characters; Received value: ${loginOrEmail}`,
        },
      ],
    });

    // 🔸 Убеждаемся, что cookie не установлен
    expect(resLogin.headers['set-cookie']).toBeUndefined();

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resLogin.body,
        resLogin.statusCode,
        'Test №7: AuthController - login() (POST: /auth/login)',
      );
    }
  });

  it('should not be authorized if the user has sent incorrect data (loginOrEmail: non-existent login)', async () => {
    // 🔻 Генерируем случайную строку, имитирующую несуществующий loginOrEmail
    const loginOrEmail: string = TestUtils.generateRandomString(10);

    // 🔻 Создаём одного пользователя с подтверждённым email (для имитации существующих пользователей)
    await usersTestManager.createUser(1);

    // 🔻 Пытаемся авторизоваться с несуществующим loginOrEmail и корректным паролем
    const resLogin: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/login`)
      .send({
        loginOrEmail,
        password: 'qwerty',
      })
      .expect(HttpStatus.UNAUTHORIZED);

    // 🔸 Убеждаемся, что refreshToken не установлен в Set-Cookie
    expect(resLogin.headers['set-cookie']).toBeUndefined();

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resLogin.body,
        resLogin.statusCode,
        'Test №8: AuthController - login() (POST: /auth)',
      );
    }
  });

  it('should not be authorized if the user has sent incorrect data (password: invalid password).', async () => {
    // 🔻 Создаём нового пользователя с подтверждённым email
    const [user]: UserViewDto[] = await usersTestManager.createUser(1);

    // 🔻 Отправляем неверный пароль в запросе на вход (при этом loginOrEmail — валидный email пользователя)
    const resLogin: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/login`)
      .send({
        loginOrEmail: user.email,
        password: 'incorrect_password',
      })
      .expect(HttpStatus.UNAUTHORIZED);

    // 🔸 Проверяем, что refreshToken не установлен в заголовках Set-Cookie
    expect(resLogin.headers['set-cookie']).toBeUndefined();

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resLogin.body,
        resLogin.statusCode,
        'Test №9: AuthController - login() (POST: /auth)',
      );
    }
  });
});
