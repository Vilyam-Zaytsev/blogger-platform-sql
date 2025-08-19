import request, { Response } from 'supertest';
import { UsersTestManager } from '../managers/users.test-manager';
import { GLOBAL_PREFIX } from '../../src/setup/global-prefix.setup';
import { TestLoggers } from '../helpers/test.loggers';
import { AppTestManager } from '../managers/app.test-manager';
import { AdminCredentials, TestResultLogin } from '../types';
import { Server } from 'http';
import { TestUtils } from '../helpers/test.utils';
import { UserAccountsConfig } from '../../src/modules/user-accounts/config/user-accounts.config';
import { JwtService } from '@nestjs/jwt';
import { HttpStatus } from '@nestjs/common';
import { ACCESS_TOKEN_STRATEGY_INJECT_TOKEN } from '../../src/modules/user-accounts/auth/constants/auth-tokens.inject-constants';
import { UserViewDto } from '../../src/modules/user-accounts/users/api/view-dto/user.view-dto';

describe('AuthController - me() (POST: /auth/me)', () => {
  let appTestManager: AppTestManager;
  let usersTestManager: UsersTestManager;
  let adminCredentials: AdminCredentials;
  let adminCredentialsInBase64: string;
  let testLoggingEnabled: boolean;
  let server: Server;

  beforeAll(async () => {
    appTestManager = new AppTestManager();
    await appTestManager.init((moduleBuilder) =>
      moduleBuilder.overrideProvider(ACCESS_TOKEN_STRATEGY_INJECT_TOKEN).useFactory({
        factory: (userAccountsConfig: UserAccountsConfig) => {
          return new JwtService({
            secret: userAccountsConfig.accessTokenSecret,
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

  it('should return information about the user if the user is logged in (sends a valid access token)', async () => {
    // 🔻 Создаём нового пользователя
    const [user]: UserViewDto[] = await usersTestManager.createUser(1);

    // 🔻 Логинимся под этим пользователем и получаем пару access/refresh токенов
    const [resultLogin]: TestResultLogin[] = await usersTestManager.login([user.login]);

    // 🔻 Извлекаем accessToken для авторизации запроса
    const accessToken: string = resultLogin.authTokens.accessToken;

    // 🔻 Отправляем GET-запрос на /auth/me с заголовком Authorization
    const resMe: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/auth/me`)
      .set('Authorization', `Bearer ${accessToken}`)
      // 🔸 Ожидаем успешный ответ (200 OK)
      .expect(HttpStatus.OK);

    // 🔻 Проверяем, что тело ответа содержит корректную информацию о пользователе
    expect(resMe.body).toEqual(
      expect.objectContaining({
        email: user.email,
        login: user.login,
        userId: user.id,
      }),
    );

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resMe.body,
        resMe.statusCode,
        'Test №1: AuthController - me() (POST: /auth/me)',
      );
    }
  });

  it('should return a 401 error if the user is not logged in (sending an invalid access token)', async () => {
    // 🔻 Создаём нового пользователя
    const [user]: UserViewDto[] = await usersTestManager.createUser(1);

    // 🔻 Логинимся под этим пользователем и получаем пару access/pfghjrefresh токенов
    const [resultLogin]: TestResultLogin[] = await usersTestManager.login([user.login]);

    // 🔻 Сохраняем accessToken, который через 3 секунды станет невалидным
    const accessToken: string = resultLogin.authTokens.accessToken;

    // 🔻 Ждём, пока accessToken протухнет (в соответствии с конфигурацией TTL)
    await TestUtils.delay(3000);

    // 🔻 Отправляем GET-запрос на /auth/me с протухшим access-токеном
    const resMe: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/auth/me`)
      .set('Authorization', `Bearer ${accessToken}`)
      // 🔸 Ожидаем, что сервер вернёт 401 Unauthorized
      .expect(HttpStatus.UNAUTHORIZED);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resMe.body,
        resMe.statusCode,
        'Test №2: AuthController - me() (POST: /auth/me)',
      );
    }
  });
});
