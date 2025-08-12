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

describe('SessionsController - deleteSessions() (DELETE: /security/devices)', () => {
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
    await appTestManager.cleanupDb(['schema_migrations']);

    appTestManager.clearThrottlerStorage();
  });

  afterAll(async () => {
    await appTestManager.close();
  });

  it('should delete all active sessions except the current one if the user is logged in', async () => {
    // 🔻 Создаём пользователя
    const [createdUser]: UserViewDto[] = await usersTestManager.createUser(1);

    // 🔻 Массив для хранения данных о сессиях
    const resultLogins: TestResultLogin[] = [];

    // 🔻 User-Agent'ы для эмуляции входа с разных устройств
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

      // 🔸 Проверяем, что вернулся accessToken
      expect(res.body).toEqual(
        expect.objectContaining({
          accessToken: expect.any(String),
        }),
      );

      // 🔸 Сохраняем пару токенов для дальнейших запросов
      const authTokens = {
        accessToken: res.body.accessToken,
        refreshToken: res.headers['set-cookie'][0].split(';')[0].split('=')[1],
      };

      resultLogins.push({
        loginOrEmail: createdUser.login,
        authTokens,
      });
    }

    // 🔻 Получаем список всех сессий (должно быть 4)
    const resGetSessions_1: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/security/devices`)
      .set('Cookie', [`refreshToken=${resultLogins[0].authTokens.refreshToken}`])
      .expect(HttpStatus.OK);

    expect(resGetSessions_1.body.length).toEqual(4);

    // 🔻 Удаляем все сессии, кроме текущей
    const resDeleteSessions: Response = await request(server)
      .delete(`/${GLOBAL_PREFIX}/security/devices`)
      .set('Cookie', [`refreshToken=${resultLogins[0].authTokens.refreshToken}`])
      .expect(HttpStatus.NO_CONTENT);

    // 🔻 Получаем список сессий повторно
    const resGetSessions_2: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/security/devices`)
      .set('Cookie', [`refreshToken=${resultLogins[0].authTokens.refreshToken}`])
      .expect(HttpStatus.OK);

    // 🔸 Должна остаться только одна сессия
    expect(resGetSessions_2.body.length).toEqual(1);

    // 🔸 Эта сессия должна совпадать с первой из предыдущего списка
    expect(resGetSessions_2.body[0]).toEqual(resGetSessions_1.body[0]);

    // 🔸 И иметь корректный User-Agent
    expect(resGetSessions_2.body[0].title).toEqual(parseUserAgent(shortUserAgents[0]));

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resDeleteSessions.body,
        resDeleteSessions.statusCode,
        'Test №1: SessionsController - deleteSessions() (DELETE: /security/devices)',
      );
    }
  });

  it('should not delete all active sessions except the current one if the user is not logged in.', async () => {
    // 🔻 Создаём одного пользователя
    const [createdUser]: UserViewDto[] = await usersTestManager.createUser(1);

    // 🔻 Массив для хранения данных о сессиях
    const resultLogins: TestResultLogin[] = [];

    // 🔻 User-Agent'ы для эмуляции входа с разных устройств
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

      // 🔸 Проверяем, что вернулся accessToken
      expect(res.body).toEqual(
        expect.objectContaining({
          accessToken: expect.any(String),
        }),
      );

      // 🔸 Сохраняем пару токенов для дальнейших запросов
      const authTokens = {
        accessToken: res.body.accessToken,
        refreshToken: res.headers['set-cookie'][0].split(';')[0].split('=')[1],
      };

      resultLogins.push({
        loginOrEmail: createdUser.login,
        authTokens,
      });
    }

    // 🔻 Получаем список всех сессий (должно быть 4)
    const resGetSessions_1: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/security/devices`)
      .set('Cookie', [`refreshToken=${resultLogins[0].authTokens.refreshToken}`])
      .expect(HttpStatus.OK);

    expect(resGetSessions_1.body.length).toEqual(4);

    // 🔻 Пытаемся удалить все сессии без авторизации
    await request(server)
      .delete(`/${GLOBAL_PREFIX}/security/devices`)
      .expect(HttpStatus.UNAUTHORIZED);

    // 🔸 Делаем задержку, чтобы accessToken и refreshToken первого логина точно истекли
    await TestUtils.delay(3000);

    // 🔻 Пытаемся удалить все сессии с просроченным refreshToken
    const resDeleteSessions: Response = await request(server)
      .delete(`/${GLOBAL_PREFIX}/security/devices`)
      .set('Cookie', [`refreshToken=${resultLogins[0].authTokens.refreshToken}`])
      .expect(HttpStatus.UNAUTHORIZED);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resDeleteSessions.body,
        resDeleteSessions.statusCode,
        'Test №2: SessionsController - deleteSessions() (DELETE: /security/devices)',
      );
    }
  });
});
