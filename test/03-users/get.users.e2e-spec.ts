import { AppTestManager } from '../managers/app.test-manager';
import { UsersTestManager } from '../managers/users.test-manager';
import { AdminCredentials } from '../types';
import { Server } from 'http';
import request, { Response } from 'supertest';
import { GLOBAL_PREFIX } from '../../src/setup/global-prefix.setup';
import { TestUtils } from '../helpers/test.utils';
import { TestLoggers } from '../helpers/test.loggers';
import { Filter } from '../helpers/filter';
import { HttpStatus } from '@nestjs/common';
import { UserViewDto } from '../../src/modules/user-accounts/users/api/view-dto/user.view-dto';
import { GetUsersQueryParams } from '../../src/modules/user-accounts/users/api/input-dto/get-users-query-params.input-dto';

describe('UsersController - getUser() (GET: /users)', () => {
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
  });

  afterAll(async () => {
    await appTestManager.close();
  });

  it('should return an empty array, the admin is authenticated.', async () => {
    // 🔻 Выполняем GET-запрос для получения списка пользователей
    const resGetUsers: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/sa/users`)
      .set('Authorization', adminCredentialsInBase64)
      .expect(HttpStatus.OK);

    // 🔸 Проверяем структуру и содержимое ответа сервера
    expect(resGetUsers.body).toEqual({
      pagesCount: 0,
      page: 1,
      pageSize: 10,
      totalCount: 0,
      items: [],
    });

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resGetUsers.body,
        resGetUsers.statusCode,
        'Test №1: UsersController - getUser() (GET: /users)',
      );
    }
  });

  it('should return a 401 error if the admin is not authenticated', async () => {
    // 🔻 Выполняем GET-запрос для получения списка пользователей с некорректными правами доступа
    const resGetUsers: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/sa/users`)
      .set('Authorization', 'incorrect admin credentials')
      .expect(HttpStatus.UNAUTHORIZED);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resGetUsers.body,
        resGetUsers.statusCode,
        'Test №2: UsersController - getUser() (GET: /users)',
      );
    }
  });

  it('should return an array with a single user, the admin is authenticated.', async () => {
    // 🔻 Создаем тестового пользователя через менеджер пользователей
    const [createdUser]: UserViewDto[] = await usersTestManager.createUser(1);

    // 🔻 Выполняем GET-запрос для получения списка пользователей
    const resGetUsers: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/sa/users`)
      .set('Authorization', adminCredentialsInBase64)
      .expect(HttpStatus.OK);

    // 🔸 Проверяем, что полученный пользователь совпадает с созданным
    expect(resGetUsers.body.items[0]).toEqual(createdUser);
    // 🔸 Проверяем, что в списке содержится ровно один пользователь
    expect(resGetUsers.body.items.length).toEqual(1);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resGetUsers.body,
        resGetUsers.statusCode,
        'Test №3: UsersController - getUser() (GET: /users)',
      );
    }
  });

  it('should return an array with a three users, the admin is authenticated.', async () => {
    // 🔻 Создаем трех тестовых пользователей через менеджер пользователей
    const createdUsers: UserViewDto[] = await usersTestManager.createUser(3);

    // 🔻 Выполняем GET-запрос для получения списка пользователей
    const resGetUsers: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/sa/users`)
      .set('Authorization', adminCredentialsInBase64)
      .expect(HttpStatus.OK);

    // 🔻 Создаем параметры запроса для фильтрации
    const query: GetUsersQueryParams = new GetUsersQueryParams();
    // 🔻 Применяем фильтрацию и сортировку к созданным пользователям
    const filteredCreatedUsers: UserViewDto[] = new Filter<UserViewDto>(
      createdUsers,
    )
      .sort({ [query.sortBy]: query.sortDirection })
      .getResult();

    // 🔸 Проверяем, что полученный список пользователей совпадает с отфильтрованным
    expect(resGetUsers.body.items).toEqual(filteredCreatedUsers);
    // 🔸 Проверяем, что в списке содержится ровно три пользователя
    expect(resGetUsers.body.items.length).toEqual(3);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resGetUsers.body,
        resGetUsers.statusCode,
        'Test №4: UsersController - getUser() (GET: /users)',
      );
    }
  });
});
