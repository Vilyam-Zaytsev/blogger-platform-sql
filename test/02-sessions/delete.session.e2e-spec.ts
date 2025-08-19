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
import { CryptoService } from '../../src/modules/user-accounts/users/application/services/crypto.service';

describe('SessionsController - deleteSession() (DELETE: /security/devices/{deviceId})', () => {
  let appTestManager: AppTestManager;
  let usersTestManager: UsersTestManager;
  let adminCredentials: AdminCredentials;
  let adminCredentialsInBase64: string;
  let cryptoService: CryptoService;
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

    cryptoService = appTestManager.app.get(CryptoService);
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

  it('should delete a specific session by ID if the user is logged in.', async () => {
    // 🔻 Создаём пользователя
    const [createdUser]: UserViewDto[] = await usersTestManager.createUser(1);

    // 🔻 Массив для хранения информации о логинах на разных устройствах
    const resultLogins: TestResultLogin[] = [];

    // 🔻 User-Agent'ы для имитации входа с разных устройств
    const shortUserAgents = [
      'Chrome/114.0 (Windows NT 10.0; Win64; x64)',
      'Safari/604.1 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
      'Firefox/102.0 (X11; Ubuntu; Linux x86_64)',
      'Chrome/114.0 (Linux; Android 13; SM-S901B)',
    ];

    // 🔻 Логиним пользователя на 4 разных устройствах
    for (let i = 0; i < 4; i++) {
      const res: Response = await request(server)
        .post(`/${GLOBAL_PREFIX}/auth/login`)
        .set('User-Agent', shortUserAgents[i])
        .send({
          loginOrEmail: createdUser.login,
          password: 'qwerty',
        })
        .expect(HttpStatus.OK);

      // 🔸 Проверяем, что получили accessToken
      expect(res.body).toEqual(
        expect.objectContaining({
          accessToken: expect.any(String),
        }),
      );

      // 🔸 Сохраняем accessToken и refreshToken
      const authTokens = {
        accessToken: res.body.accessToken,
        refreshToken: res.headers['set-cookie'][0].split(';')[0].split('=')[1],
      };

      resultLogins.push({
        loginOrEmail: createdUser.login,
        authTokens,
      });
    }

    // 🔻 Получаем список всех сессий пользователя
    const resGetSessions_1: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/security/devices`)
      .set('Cookie', [`refreshToken=${resultLogins[0].authTokens.refreshToken}`])
      .expect(HttpStatus.OK);

    // 🔸 Проверяем, что у пользователя 4 активные сессии
    expect(resGetSessions_1.body.length).toEqual(4);

    // 🔻 Запоминаем ID первой сессии для удаления
    const deviceId_1: string = resGetSessions_1.body[0].deviceId;

    // 🔻 Отправляем запрос на удаление конкретной сессии по её ID
    const resDeleteSession: Response = await request(server)
      .delete(`/${GLOBAL_PREFIX}/security/devices/${deviceId_1}`)
      .set('Cookie', [`refreshToken=${resultLogins[0].authTokens.refreshToken}`])
      .expect(HttpStatus.NO_CONTENT);

    // 🔻 Проверяем, что после удаления сессии по её токену авторизация невозможна
    await request(server)
      .get(`/${GLOBAL_PREFIX}/security/devices`)
      .set('Cookie', [`refreshToken=${resultLogins[0].authTokens.refreshToken}`])
      .expect(HttpStatus.UNAUTHORIZED);

    // 🔻 Получаем список сессий, используя refreshToken другой активной сессии
    const resGetSessions_2: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/security/devices`)
      .set('Cookie', [`refreshToken=${resultLogins[1].authTokens.refreshToken}`])
      .expect(HttpStatus.OK);

    // 🔸 Проверяем, что осталось 3 активные сессии
    expect(resGetSessions_2.body.length).toEqual(3);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resDeleteSession.body,
        resDeleteSession.statusCode,
        'Test №1: SessionsController - deleteSession() (DELETE: /security/devices/{deviceId})',
      );
    }
  });

  it('should not delete a specific session if the user is not logged in.', async () => {
    // 🔻 Создаём пользователя
    const [createdUser]: UserViewDto[] = await usersTestManager.createUser(1);

    // 🔻 Массив для хранения информации о логинах на разных устройствах
    const resultLogins: TestResultLogin[] = [];

    // 🔻 User-Agent'ы для имитации входа с разных устройств
    const shortUserAgents = [
      'Chrome/114.0 (Windows NT 10.0; Win64; x64)',
      'Safari/604.1 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
      'Firefox/102.0 (X11; Ubuntu; Linux x86_64)',
      'Chrome/114.0 (Linux; Android 13; SM-S901B)',
    ];

    // 🔻 Логиним пользователя на 4 разных устройствах
    for (let i = 0; i < 4; i++) {
      const res: Response = await request(server)
        .post(`/${GLOBAL_PREFIX}/auth/login`)
        .set('User-Agent', shortUserAgents[i])
        .send({
          loginOrEmail: createdUser.login,
          password: 'qwerty',
        })
        .expect(HttpStatus.OK);

      // 🔸 Проверяем, что получили accessToken
      expect(res.body).toEqual(
        expect.objectContaining({
          accessToken: expect.any(String),
        }),
      );

      // 🔸 Сохраняем accessToken и refreshToken
      const authTokens = {
        accessToken: res.body.accessToken,
        refreshToken: res.headers['set-cookie'][0].split(';')[0].split('=')[1],
      };

      resultLogins.push({
        loginOrEmail: createdUser.login,
        authTokens,
      });
    }

    // 🔻 Получаем список всех сессий пользователя
    const resGetSessions_1: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/security/devices`)
      .set('Cookie', [`refreshToken=${resultLogins[0].authTokens.refreshToken}`])
      .expect(HttpStatus.OK);

    // 🔸 Проверяем, что у пользователя 4 активные сессии
    expect(resGetSessions_1.body.length).toEqual(4);

    // 🔻 Запоминаем ID первой сессии
    const deviceId_1: string = resGetSessions_1.body[0].deviceId;

    // 🔻 Пытаемся удалить сессию без авторизации — ожидаем ошибку 401
    await request(server)
      .delete(`/${GLOBAL_PREFIX}/security/devices/${deviceId_1}`)
      .expect(HttpStatus.UNAUTHORIZED);

    // 🔻 Делаем паузу, чтобы refreshToken гарантированно устарел для проверки
    await TestUtils.delay(3000);

    // 🔻 Пытаемся удалить сессию, используя refreshToken, который должен быть невалидным — снова ожидаем ошибку 401
    const resDeleteSession: Response = await request(server)
      .delete(`/${GLOBAL_PREFIX}/security/devices/${deviceId_1}`)
      .set('Cookie', [`refreshToken=${resultLogins[0].authTokens.refreshToken}`])
      .expect(HttpStatus.UNAUTHORIZED);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resDeleteSession.body,
        resDeleteSession.statusCode,
        'Test №2: SessionsController - deleteSession() (DELETE: /security/devices/{deviceId})',
      );
    }
  });

  it('should not delete a specific session if the user is not the owner of this device.', async () => {
    // 🔻 Создаём двух пользователей
    const [createdUser_1, createdUser_2]: UserViewDto[] = await usersTestManager.createUser(2);

    // 🔻 Массив для хранения информации о логинах
    const resultLogins: TestResultLogin[] = [];

    // 🔻 User-Agent'ы для имитации входа с разных устройств
    const shortUserAgents = [
      'Chrome/114.0 (Windows NT 10.0; Win64; x64)', // для user1
      'Safari/604.1 (iPhone; CPU iPhone OS 16_0 like Mac OS X)', // для user2
    ];

    // 🔻 Логиним каждого пользователя на своём устройстве
    for (let i = 0; i < 2; i++) {
      // 🔸 Чётные индексы — user1, нечётные — user2
      const login: string = (i + 1) % 2 === 0 ? createdUser_2.login : createdUser_1.login;

      const res: Response = await request(server)
        .post(`/${GLOBAL_PREFIX}/auth/login`)
        .set('User-Agent', shortUserAgents[i])
        .send({
          loginOrEmail: login,
          password: 'qwerty',
        })
        .expect(HttpStatus.OK);

      // 🔸 Проверяем, что получили accessToken
      expect(res.body).toEqual(
        expect.objectContaining({
          accessToken: expect.any(String),
        }),
      );

      // 🔸 Сохраняем токены для последующего использования
      const authTokens = {
        accessToken: res.body.accessToken,
        refreshToken: res.headers['set-cookie'][0].split(';')[0].split('=')[1],
      };

      resultLogins.push({
        loginOrEmail: login,
        authTokens,
      });
    }

    // 🔻 Получаем список сессий пользователя 1
    const resGetSessions_user1: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/security/devices`)
      .set('Cookie', [`refreshToken=${resultLogins[0].authTokens.refreshToken}`])
      .expect(HttpStatus.OK);

    // 🔻 Получаем список сессий пользователя 2
    const resGetSessions_user2: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/security/devices`)
      .set('Cookie', [`refreshToken=${resultLogins[1].authTokens.refreshToken}`])
      .expect(HttpStatus.OK);

    // 🔻 Извлекаем ID сессий каждого пользователя
    const deviceId_user1: string = resGetSessions_user1.body[0].deviceId;
    const deviceId_user2: string = resGetSessions_user2.body[0].deviceId;

    // 🔻 Пользователь 1 пытается удалить сессию пользователя 2 — ожидаем 403
    const resDeleteSession: Response = await request(server)
      .delete(`/${GLOBAL_PREFIX}/security/devices/${deviceId_user2}`)
      .set('Cookie', [`refreshToken=${resultLogins[0].authTokens.refreshToken}`])
      .expect(HttpStatus.FORBIDDEN);

    // 🔻 Пользователь 2 пытается удалить сессию пользователя 1 — ожидаем 403
    await request(server)
      .delete(`/${GLOBAL_PREFIX}/security/devices/${deviceId_user1}`)
      .set('Cookie', [`refreshToken=${resultLogins[1].authTokens.refreshToken}`])
      .expect(HttpStatus.FORBIDDEN);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resDeleteSession.body,
        resDeleteSession.statusCode,
        'Test №3: SessionsController - deleteSession() (DELETE: /security/devices/{deviceId})',
      );
    }
  });

  it('should not delete a specific session if no such session exists.', async () => {
    // 🔻 Создаём одного пользователя
    const [createdUser]: UserViewDto[] = await usersTestManager.createUser(1);

    // 🔻 Массив для хранения информации о логинах
    const resultLogins: TestResultLogin[] = [];

    // 🔻 User-Agent'ы для имитации входа с разных устройств
    const shortUserAgents = [
      'Chrome/114.0 (Windows NT 10.0; Win64; x64)',
      'Safari/604.1 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
      'Firefox/102.0 (X11; Ubuntu; Linux x86_64)',
      'Chrome/114.0 (Linux; Android 13; SM-S901B)',
    ];

    // 🔻 Логиним пользователя на 4-х устройствах
    for (let i = 0; i < 4; i++) {
      const res: Response = await request(server)
        .post(`/${GLOBAL_PREFIX}/auth/login`)
        .set('User-Agent', shortUserAgents[i])
        .send({
          loginOrEmail: createdUser.login,
          password: 'qwerty',
        })
        .expect(HttpStatus.OK);

      // 🔸 Проверяем, что получили accessToken
      expect(res.body).toEqual(
        expect.objectContaining({
          accessToken: expect.any(String),
        }),
      );

      // 🔸 Сохраняем токены для последующего использования
      const authTokens = {
        accessToken: res.body.accessToken,
        refreshToken: res.headers['set-cookie'][0].split(';')[0].split('=')[1],
      };

      resultLogins.push({
        loginOrEmail: createdUser.login,
        authTokens,
      });
    }

    // 🔻 Получаем список всех активных сессий
    const resGetSessions_1: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/security/devices`)
      .set('Cookie', [`refreshToken=${resultLogins[0].authTokens.refreshToken}`])
      .expect(HttpStatus.OK);

    expect(resGetSessions_1.body.length).toEqual(4);

    // 🔻 Генерируем несуществующий UUID для сессии
    const incorrectId: string = cryptoService.generateUUID();

    // 🔻 Пытаемся удалить сессию по несуществующему ID → ожидаем 404
    const resDeleteSession: Response = await request(server)
      .delete(`/${GLOBAL_PREFIX}/security/devices/${incorrectId}`)
      .set('Cookie', [`refreshToken=${resultLogins[0].authTokens.refreshToken}`])
      .expect(HttpStatus.NOT_FOUND);

    // 🔻 Проверяем, что список сессий не изменился
    const resGetSessions_2: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/security/devices`)
      .set('Cookie', [`refreshToken=${resultLogins[0].authTokens.refreshToken}`])
      .expect(HttpStatus.OK);

    expect(resGetSessions_2.body.length).toEqual(4);
    expect(resGetSessions_2.body).toEqual(resGetSessions_1.body);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resDeleteSession.body,
        resDeleteSession.statusCode,
        'Test №4: SessionsController - deleteSession() (DELETE: /security/devices/{deviceId})',
      );
    }
  });
});
