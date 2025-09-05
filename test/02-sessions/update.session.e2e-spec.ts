import request, { Response } from 'supertest';
import { TestUtils } from '../helpers/test.utils';
import { GLOBAL_PREFIX } from '../../src/setup/global-prefix.setup';
import { AppTestManager } from '../managers/app.test-manager';
import { AdminCredentials } from '../types';
import { Server } from 'http';
import { HttpStatus } from '@nestjs/common';
import { UsersTestManager } from '../managers/users.test-manager';
import { UserAccountsConfig } from '../../src/modules/user-accounts/config/user-accounts.config';
import { JwtService } from '@nestjs/jwt';
import { REFRESH_TOKEN_STRATEGY_INJECT_TOKEN } from '../../src/modules/user-accounts/auth/constants/auth-tokens.inject-constants';
import { UserViewDto } from '../../src/modules/user-accounts/users/api/view-dto/user.view-dto';
import { parseUserAgent } from '../../src/core/utils/user-agent.parser';
import { CoreConfig } from '../../src/core/core.config';
import { ConfigService } from '@nestjs/config';

describe('SessionsController - deleteSession() (DELETE: /security/devices/{deviceId})', () => {
  let appTestManager: AppTestManager;
  let usersTestManager: UsersTestManager;
  let adminCredentials: AdminCredentials;
  let adminCredentialsInBase64: string;
  let server: Server;

  beforeAll(async () => {
    appTestManager = new AppTestManager();
    await appTestManager.init((moduleBuilder) =>
      moduleBuilder
        .overrideProvider(REFRESH_TOKEN_STRATEGY_INJECT_TOKEN)
        .useFactory({
          factory: (userAccountsConfig: UserAccountsConfig) => {
            return new JwtService({
              secret: userAccountsConfig.refreshTokenSecret,
              signOptions: { expiresIn: '20s' },
            });
          },
          inject: [UserAccountsConfig],
        })

        .overrideProvider(CoreConfig)
        .useFactory({
          factory: (configService: ConfigService<any, true>) => {
            const coreConfig = new CoreConfig(configService);
            coreConfig.throttleLimit = 10000;
            coreConfig.throttleTtl = 15;

            return coreConfig;
          },
          inject: [ConfigService],
        }),
    );

    adminCredentials = appTestManager.getAdminCredentials();
    adminCredentialsInBase64 = TestUtils.encodingAdminDataInBase64(
      adminCredentials.login,
      adminCredentials.password,
    );
    server = appTestManager.getServer();

    usersTestManager = new UsersTestManager(server, adminCredentialsInBase64);
  });

  beforeEach(async () => {
    await appTestManager.cleanupDb(['schema_migrations']);

    appTestManager.clearThrottlerStorage();
  });

  afterAll(async () => {
    await appTestManager.close();
  });

  it.skip('should update the lastActiveDate only for the session where the refresh token was used (other sessions remain unchanged)', async () => {
    // 🔻 Создаём двух пользователей
    const createdUsers: UserViewDto[] = await usersTestManager.createUser(2);

    // 🔻 Список User-Agent для имитации входа с разных устройств
    const shortUserAgents = [
      'Chrome/114.0 (Windows NT 10.0; Win64; x64)',
      'Safari/604.1 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
      'Firefox/102.0 (X11; Ubuntu; Linux x86_64)',
      'Chrome/114.0 (Linux; Android 13; SM-S901B)',
    ];

    // 🔻 Хранилище ответов при логине для каждого пользователя
    const resLogins: Record<string, Response[]> = {
      resLogins_user1: [],
      resLogins_user2: [],
    };

    // 🔻 Логиним каждого пользователя на всех 4 устройствах
    for (let i = 0; i < createdUsers.length; i++) {
      for (let j = 0; j < shortUserAgents.length; j++) {
        const res: Response = await request(server)
          .post(`/${GLOBAL_PREFIX}/auth/login`)
          .set('User-Agent', parseUserAgent(shortUserAgents[j]))
          .send({
            loginOrEmail: createdUsers[i].login,
            password: 'qwerty',
          })
          .expect(HttpStatus.OK);

        // 🔸 Проверяем, что логин вернул accessToken
        expect(res.body).toEqual({
          accessToken: expect.any(String),
        });

        // 🔸 Сохраняем ответ
        resLogins[`resLogins_user${i + 1}`].push(res);

        // 🔸 Делаем задержку, чтобы lastActiveDate отличалось
        await TestUtils.delay(1000);
      }
    }

    // 🔻 1. Тест для первого пользователя
    const refreshToken_user1_session1: string = resLogins.resLogins_user1[0].headers[
      'set-cookie'
    ][0]
      .split(';')[0]
      .split('=')[1];

    // 🔻 Получаем все сессии до обновления
    const resGetSessions_user1: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/security/devices`)
      .set('Cookie', [`refreshToken=${refreshToken_user1_session1}`])
      .expect(HttpStatus.OK);

    // 🔻 Поочерёдно обновляем refreshToken в каждой сессии и проверяем, что
    // изменился только lastActiveDate этой сессии
    for (let i = 0; i < resLogins.resLogins_user1.length; i++) {
      await TestUtils.delay(1000);

      const refreshToken: string = resLogins.resLogins_user1[i].headers['set-cookie'][0]
        .split(';')[0]
        .split('=')[1];

      // 🔻 Обновляем пару токенов для конкретной сессии
      const resRefreshToken: Response = await request(server)
        .post(`/${GLOBAL_PREFIX}/auth/refresh-token`)
        .set('Cookie', [`refreshToken=${refreshToken}`])
        .expect(HttpStatus.OK);

      // 🔻 Получаем обновлённый список сессий
      const resGetSessions: Response = await request(server)
        .get(`/${GLOBAL_PREFIX}/security/devices`)
        .set('Cookie', [
          `refreshToken=${resRefreshToken.headers['set-cookie'][0].split(';')[0].split('=')[1]}`,
        ])
        .expect(HttpStatus.OK);

      //TODO: необходимо переписать тест(проблема в сортировке при выборке)

      // 🔸 Проверяем, что lastActiveDate изменился только у текущей сессии
      expect(resGetSessions_user1.body[i].lastActiveDate).not.toEqual(
        resGetSessions.body[i].lastActiveDate,
      );
      // 🔸 Все остальные сессии остались без изменений
      for (let j = i + 1; j < resGetSessions_user1.body.length; j++) {
        expect(resGetSessions.body[j].lastActiveDate).toEqual(
          resGetSessions_user1.body[j].lastActiveDate,
        );
      }

      // 🔻 2. Тест для второго пользователя
      const refreshToken_user2_session1: string = resLogins.resLogins_user2[0].headers[
        'set-cookie'
      ][0]
        .split(';')[0]
        .split('=')[1];

      // 🔻 Получаем все сессии второго пользователя до обновления
      const resGetDevices_user2: Response = await request(server)
        .get(`/${GLOBAL_PREFIX}/security/devices`)
        .set('Cookie', [`refreshToken=${refreshToken_user2_session1}`])
        .expect(HttpStatus.OK);

      // 🔻 Аналогично обновляем токены и проверяем только свою сессию
      for (let i = 0; i < resLogins.resLogins_user2.length; i++) {
        await TestUtils.delay(1000);

        const refreshToken: string = resLogins.resLogins_user2[i].headers['set-cookie'][0]
          .split(';')[0]
          .split('=')[1];

        const resRefreshToken: Response = await request(server)
          .post(`/${GLOBAL_PREFIX}/auth/refresh-token`)
          .set('Cookie', [`refreshToken=${refreshToken}`])
          .expect(HttpStatus.OK);

        const resGetSessions: Response = await request(server)
          .get(`/${GLOBAL_PREFIX}/security/devices`)
          .set('Cookie', [
            `refreshToken=${resRefreshToken.headers['set-cookie'][0].split(';')[0].split('=')[1]}`,
          ])
          .expect(HttpStatus.OK);

        // 🔸 Проверяем, что изменилась только текущая сессия
        expect(resGetSessions.body[i].lastActiveDate).not.toEqual(
          resGetDevices_user2.body[i].lastActiveDate,
        );

        // 🔸 Остальные не изменились
        for (let j = i + 1; j < resGetDevices_user2.body.length; j++) {
          expect(resGetSessions.body[j].lastActiveDate).toEqual(
            resGetDevices_user2.body[j].lastActiveDate,
          );
        }
      }
    }
  }, 50000);
});
