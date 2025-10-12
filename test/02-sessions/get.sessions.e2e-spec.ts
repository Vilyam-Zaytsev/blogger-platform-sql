import request, { Response } from 'supertest';
import { TestUtils } from '../helpers/test.utils';
import { GLOBAL_PREFIX } from '../../src/setup/global-prefix.setup';
import { TestLoggers } from '../helpers/test.loggers';
import { AppTestManager } from '../managers/app.test-manager';
import { AdminCredentials, TestResultLogin } from '../types';
import { Server } from 'http';
import { HttpStatus } from '@nestjs/common';
import { UsersTestManager } from '../managers/users.test-manager';
import { UserAccountsConfig } from '../../src/modules/user-accounts/config/user-accounts.config';
import { JwtService } from '@nestjs/jwt';
import { REFRESH_TOKEN_STRATEGY_INJECT_TOKEN } from '../../src/modules/user-accounts/auth/constants/auth-tokens.inject-constants';
import { UserViewDto } from '../../src/modules/user-accounts/users/api/view-dto/user.view-dto';
import { parseUserAgent } from '../../src/core/utils/user-agent.parser';

describe('SessionsController - getAll() (GET: /security/devices)', () => {
  let appTestManager: AppTestManager;
  let usersTestManager: UsersTestManager;
  let adminCredentials: AdminCredentials;
  let adminCredentialsInBase64: string;
  let testLoggingEnabled: boolean;
  let server: Server;

  beforeAll(async () => {
    appTestManager = new AppTestManager();
    await appTestManager.init((moduleBuilder) =>
      moduleBuilder.overrideProvider(REFRESH_TOKEN_STRATEGY_INJECT_TOKEN).useFactory({
        factory: (userAccountsConfig: UserAccountsConfig) => {
          return new JwtService({
            secret: userAccountsConfig.refreshTokenSecret,
            signOptions: { expiresIn: '2s' },
          });
        },
        inject: [UserAccountsConfig],
      }),
    );

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
    await appTestManager.cleanupDb(['migrations']);

    appTestManager.clearThrottlerStorage();
  });

  afterAll(async () => {
    await appTestManager.close();
  });

  it('should return an array with one session if the user is logged in on only one device.', async () => {
    // 🔻 Создаём одного пользователя
    const [createdUser]: UserViewDto[] = await usersTestManager.createUser(1);

    // 🔻 Логинимся под этим пользователем и получаем токены авторизации
    const [resultLogin]: TestResultLogin[] = await usersTestManager.login([createdUser.login]);

    // 🔻 Отправляем запрос на получение всех активных сессий
    // 🔸 Передаём refreshToken в Cookie для аутентификации
    const resGetSessions: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/security/devices`)
      .set('Cookie', [`refreshToken=${resultLogin.authTokens.refreshToken}`])
      .expect(HttpStatus.OK); // 🔸 Ожидаем, что запрос выполнится успешно (200 OK)

    // 🔻 Проверяем, что в ответе ровно одна сессия
    expect(resGetSessions.body.length).toEqual(1);

    // 🔻 Проверяем, что структура ответа соответствует ожидаемой
    expect(resGetSessions.body).toEqual([
      {
        ip: expect.any(String), // 🔸 IP-адрес устройства
        title: expect.any(String), // 🔸 Название устройства (User-Agent)
        lastActiveDate: expect.stringMatching(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/, // 🔸 Дата в формате ISO
        ),
        deviceId: expect.any(String), // 🔸 Уникальный идентификатор устройства
      },
    ]);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resGetSessions.body,
        resGetSessions.statusCode,
        'Test №1: SessionsController - getAll() (GET: /security/devices)',
      );
    }
  });

  it('should return an array with four sessions if the user is logged in on four different devices.', async () => {
    // 🔻 Создаём одного пользователя
    const [createdUser]: UserViewDto[] = await usersTestManager.createUser(1);

    // 🔻 Массив для хранения результатов логинов (токенов)
    const resultLogins: TestResultLogin[] = [];

    // 🔻 Массив User-Agent строк для эмуляции разных устройств
    const shortUserAgents = [
      'Chrome/114.0 (Windows NT 10.0; Win64; x64)',
      'Safari/604.1 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
      'Firefox/102.0 (X11; Ubuntu; Linux x86_64)',
      'Chrome/114.0 (Linux; Android 13; SM-S901B)',
    ];

    // 🔻 Логинимся на 4 разных устройствах
    for (let i = 0; i < 4; i++) {
      // 🔸 Отправляем запрос на логин с конкретным User-Agent
      const res: Response = await request(server)
        .post(`/${GLOBAL_PREFIX}/auth/login`)
        .set('User-Agent', shortUserAgents[i])
        .send({
          loginOrEmail: createdUser.login,
          password: 'qwerty',
        })
        .expect(HttpStatus.OK); // 🔸 Ожидаем успешный логин

      // 🔸 Проверяем, что в ответе есть accessToken
      expect(res.body).toEqual(
        expect.objectContaining({
          accessToken: expect.any(String),
        }),
      );

      // 🔻 Достаём токены из ответа
      const body = res.body as { accessToken: string };
      const authTokens = {
        accessToken: body.accessToken,
        refreshToken: res.headers['set-cookie'][0].split(';')[0].split('=')[1], // 🔸 Вытаскиваем refreshToken из cookie
      };

      // 🔻 Сохраняем токены для проверки в дальнейшем
      resultLogins.push({
        loginOrEmail: createdUser.login,
        authTokens,
      });
    }

    // 🔻 Делаем запрос на получение всех сессий с использованием refreshToken первой сессии
    const resGetSessions: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/security/devices`)
      .set('Cookie', [`refreshToken=${resultLogins[0].authTokens.refreshToken}`])
      .expect(HttpStatus.OK); // 🔸 Ожидаем успешный ответ

    // 🔻 Проверяем, что в ответе ровно 4 сессии
    expect(resGetSessions.body.length).toEqual(4);

    // 🔻 Проверяем, что каждая сессия содержит корректные данные
    for (let i = 0; i < resGetSessions.body.length; i++) {
      expect(resGetSessions.body[i]).toEqual({
        ip: expect.any(String), // 🔸 IP-адрес клиента
        title: parseUserAgent(shortUserAgents[i]), // 🔸 Ожидаемое название устройства
        lastActiveDate: expect.stringMatching(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/, // 🔸 Дата в ISO-формате
        ),
        deviceId: expect.any(String), // 🔸 Уникальный идентификатор устройства
      });
    }

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resGetSessions.body,
        resGetSessions.statusCode,
        'Test №2: SessionsController - getAll() (GET: /security/devices)',
      );
    }
  });

  it('should not return an array with sessions if the user is not logged in.', async () => {
    // 🔻 Создаём пользователя
    const [createdUser]: UserViewDto[] = await usersTestManager.createUser(1);

    // 🔻 Логинимся этим пользователем и получаем refreshToken
    const [resultLogin]: TestResultLogin[] = await usersTestManager.login([createdUser.login]);

    // 🔻 Ждём 3 секунды, чтобы refreshToken успел стать невалидным (симуляция истечения срока действия)
    await TestUtils.delay(3000);

    // 🔻 Делаем запрос на получение всех сессий с просроченным refreshToken
    const resGetSessions: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/security/devices`)
      .set('Cookie', [`refreshToken=${resultLogin.authTokens.refreshToken}`])
      .expect(HttpStatus.UNAUTHORIZED); // Ожидаем ошибку 401 — пользователь не авторизован

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resGetSessions.body,
        resGetSessions.statusCode,
        'Test №3: SessionsController - getAll() (GET: /security/devices)',
      );
    }
  });
});
