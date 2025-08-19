import request, { Response } from 'supertest';
import { UsersTestManager } from '../managers/users.test-manager';
import { GLOBAL_PREFIX } from '../../src/setup/global-prefix.setup';
import { TestLoggers } from '../helpers/test.loggers';
import { AppTestManager } from '../managers/app.test-manager';
import { AdminCredentials } from '../types';
import { Server } from 'http';
import { TestUtils } from '../helpers/test.utils';
import { HttpStatus } from '@nestjs/common';
import { UserAccountsConfig } from '../../src/modules/user-accounts/config/user-accounts.config';
import { JwtService } from '@nestjs/jwt';
import { UserViewDto } from '../../src/modules/user-accounts/users/api/view-dto/user.view-dto';
import { REFRESH_TOKEN_STRATEGY_INJECT_TOKEN } from '../../src/modules/user-accounts/auth/constants/auth-tokens.inject-constants';

describe('AuthController - refreshToken() (POST: /auth/refresh-token)', () => {
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
            signOptions: { expiresIn: '3s' },
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

  it('should return a new pair of Access and Refresh tokens if the Refresh token sent by the user is still valid.', async () => {
    // 🔻 Создаём пользователя в базе (возвращается login и email)
    const [createdUser]: UserViewDto[] = await usersTestManager.createUser(1);

    // 🔻 Выполняем логин пользователя, чтобы получить Access и Refresh токены
    const resLogin: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/login`)
      .send({
        loginOrEmail: createdUser.login,
        password: 'qwerty',
      })
      // 🔸 Ожидаем статус 200 OK, так как логин должен быть успешным
      .expect(HttpStatus.OK);

    // 🔻 Сохраняем полученные куки (в них содержится Refresh token)
    const cookiesLogin: string = resLogin.headers['set-cookie'];

    // 🔻 Добавляем искусственную задержку (1 секунда), чтобы новый токен отличался по времени создания
    await TestUtils.delay(1000);

    // 🔻 Отправляем Refresh token для получения новой пары токенов
    const resRefreshToken: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/refresh-token`)
      .set('Cookie', [...cookiesLogin]) // 🔸 Передаём Refresh token из куки
      .expect(HttpStatus.OK); // 🔸 Ожидаем статус 200 OK

    // 🔻 Сохраняем новую пару Set-Cookie (новый Refresh token)
    const cookiesRefreshToken: string = resRefreshToken.headers['set-cookie'];

    // 🔸 Проверяем, что новые Access/Refresh токены отличаются от старых
    expect(resLogin.body).not.toEqual(resRefreshToken.body); // 🔸 новый Access токен
    expect(cookiesLogin).not.toEqual(cookiesRefreshToken); // 🔸 новый Refresh токен

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resRefreshToken.body,
        resRefreshToken.statusCode,
        'Test №1: refreshToken() (POST: /auth/refresh-token)',
      );
    }
  });

  it('should not return a new pair of access and upgrade tokens if the Refresh token sent by the user is expired.', async () => {
    // 🔻 Создаём пользователя в базе данных
    const [createdUser]: UserViewDto[] = await usersTestManager.createUser(1);

    // 🔻 Выполняем логин, чтобы получить актуальную пару Access и Refresh токенов
    const resLogin: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/login`)
      .send({
        loginOrEmail: createdUser.login,
        password: 'qwerty',
      })
      // 🔸 Ожидаем статус 200 OK — успешная авторизация
      .expect(HttpStatus.OK);

    // 🔻 Сохраняем Refresh токен из куков (для последующего запроса)
    const cookiesLogin: string = resLogin.headers['set-cookie'];

    // 🔻 Ждём 3 секунды — предполагаем, что Refresh токен за это время успеет истечь
    await TestUtils.delay(3000);

    // 🔻 Пытаемся использовать просроченный Refresh токен для получения новой пары токенов
    const resRefreshToken: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/refresh-token`)
      .set('Cookie', [...cookiesLogin]) // 🔸 Передаём старый Refresh token
      // 🔸 Ожидаем статус 401 UNAUTHORIZED — токен должен быть признан недействительным
      .expect(HttpStatus.UNAUTHORIZED);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resRefreshToken.body,
        resRefreshToken.statusCode,
        'Test №2: refreshToken() (POST: /auth/refresh-token)',
      );
    }
  });

  it('should not return a new pair of access and refresh tokens if the user has logged out (Refresh token must be invalid)', async () => {
    // 🔻 Создаём нового пользователя
    const [createdUser]: UserViewDto[] = await usersTestManager.createUser(1);

    // 🔻 Логинимся этим пользователем, получая Access и Refresh токены в заголовке Set-Cookie
    const resLogin: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/login`)
      .send({
        loginOrEmail: createdUser.login,
        password: 'qwerty',
      })
      // 🔸 Ожидаем успешную авторизацию со статусом 200 OK
      .expect(HttpStatus.OK);

    // 🔻 Сохраняем куки с Refresh токеном для дальнейшего использования
    const cookiesLogin: string = resLogin.headers['set-cookie'];

    // 🔻 Выполняем logout, чтобы Refresh токен стал недействительным (удалён или занесён в blacklist)
    await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/logout`)
      .set('Cookie', [...cookiesLogin]) // 🔸 Передаём актуальный Refresh токен
      // 🔸 Ожидаем статус 204 No Content — успешный выход из системы
      .expect(HttpStatus.NO_CONTENT);

    // 🔻 Пробуем снова использовать тот же Refresh токен, который теперь должен быть недействительным
    const resRefreshToken: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/refresh-token`)
      .set('Cookie', [...cookiesLogin]) // 🔸 Передаём старый токен, который должен быть "отозван"
      // 🔸 Ожидаем статус 401 Unauthorized — токен недействителен после logout
      .expect(HttpStatus.UNAUTHORIZED);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resRefreshToken.body,
        resRefreshToken.statusCode,
        'Test №3: refreshToken() (POST: /auth/refresh-token)',
      );
    }
  });

  it('should not allow logout with an old Refresh token after it has been rotated (Refresh token reuse detection)', async () => {
    // 🔻 Создаём нового пользователя
    const [createdUser]: UserViewDto[] = await usersTestManager.createUser(1);

    // 🔻 Логинимся этим пользователем — получаем первую пару Access и Refresh токенов
    const resLogin: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/login`)
      .send({
        loginOrEmail: createdUser.login,
        password: 'qwerty',
      })
      // 🔸 Ожидаем успешный вход (200 OK)
      .expect(HttpStatus.OK);

    // 🔻 Сохраняем первую пару токенов (будем использовать её как "старую")
    const cookiesLogin: string = resLogin.headers['set-cookie'];

    // 🔻 Делаем паузу, чтобы Refresh токены отличались по времени
    await TestUtils.delay(1000);

    // 🔻 Обновляем токены через endpoint /auth/refresh-token
    const resRefreshToken: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/refresh-token`)
      .set('Cookie', [...cookiesLogin]) // 🔸 Передаём старый Refresh токен, который будет заменён на новый
      // 🔸 Ожидаем успешную замену токенов (200 OK)
      .expect(HttpStatus.OK);

    // 🔻 Пытаемся использовать старый Refresh токен снова — для logout
    await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/logout`)
      .set('Cookie', [...cookiesLogin]) // 🔸 Передаём старый (уже заменённый) токен
      // 🔸 Ожидаем 401 Unauthorized — токен больше невалиден после ротации
      .expect(HttpStatus.UNAUTHORIZED);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resRefreshToken.body,
        resRefreshToken.statusCode,
        'Test №4: refreshToken() (POST: /auth/refresh-token)',
      );
    }
  });
});
