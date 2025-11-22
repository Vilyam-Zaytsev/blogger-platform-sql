import { AppTestManager } from '../managers/app.test-manager';
import { UsersTestManager } from '../managers/users.test-manager';
import { AdminCredentials, TestSearchFilter } from '../types';
import { Server } from 'http';
import request, { Response } from 'supertest';
import { GLOBAL_PREFIX } from '../../src/setup/global-prefix.setup';
import { TestUtils } from '../helpers/test.utils';
import { TestLoggers } from '../helpers/test.loggers';
import { Filter } from '../helpers/filter';
import { HttpStatus } from '@nestjs/common';
import { UserViewDto } from '../../src/modules/user-accounts/users/api/view-dto/user.view-dto';
import {
  GetUsersQueryParams,
  UsersSortBy,
} from '../../src/modules/user-accounts/users/api/input-dto/get-users-query-params.input-dto';
import { SortDirection } from '../../src/core/dto/base.query-params.input-dto';

describe('UsersController - getUser() (GET: /users (pagination, sort, search in term))', () => {
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
    await appTestManager.cleanupDb(['migrations']);
  });

  afterAll(async () => {
    await appTestManager.close();
  });

  it('should use default pagination values when none are provided by the client.', async () => {
    // 🔻 Создаем 12 тестовых пользователей через менеджер пользователей
    const createdUsers: UserViewDto[] = await usersTestManager.createUser(12);

    // 🔻 Выполняем GET-запрос для получения списка пользователей
    const resGetUsers: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/sa/users`)
      .set('Authorization', adminCredentialsInBase64)
      .expect(HttpStatus.OK);

    // 🔻 Создаем параметры запроса для пагинации и фильтрации
    const query: GetUsersQueryParams = new GetUsersQueryParams();
    // 🔻 Применяем фильтрацию, сортировку и пагинацию к созданным пользователям
    const filteredCreatedUsers: UserViewDto[] = new Filter<UserViewDto>(createdUsers)
      .sort({ [query.sortBy]: query.sortDirection })
      .skip(query.calculateSkip())
      .limit(query.pageSize)
      .getResult();

    // 🔸 Проверяем структуру ответа сервера с учетом пагинации
    expect(resGetUsers.body).toEqual({
      pagesCount: 2,
      page: 1,
      pageSize: 10,
      totalCount: 12,
      items: filteredCreatedUsers,
    });
    // 🔸 Проверяем, что на первой странице отображается 10 пользователей
    expect(resGetUsers.body.items.length).toEqual(10);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resGetUsers.body,
        resGetUsers.statusCode,
        'Test №1: UsersController - getUser() (GET: /users (pagination, sort, search in term))',
      );
    }
  });

  it('should use client-provided pagination values to return the correct subset of data(1).', async () => {
    // 🔻 Создаем 12 тестовых пользователей через менеджер пользователей
    const createdUsers: UserViewDto[] = await usersTestManager.createUser(12);

    // 🔻 Настраиваем параметры запроса для пагинации и сортировки
    const query: GetUsersQueryParams = new GetUsersQueryParams();
    query.pageSize = 3;
    query.pageNumber = 2;
    query.sortBy = UsersSortBy.Login;
    query.sortDirection = SortDirection.Ascending;

    // 🔻 Выполняем GET-запрос с указанными параметрами
    const resGetUsers: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/sa/users`)
      .set('Authorization', adminCredentialsInBase64)
      .query(query)
      .expect(HttpStatus.OK);

    // 🔻 Применяем те же фильтрацию и сортировку к созданным пользователям
    const filteredCreatedUsers: UserViewDto[] = new Filter<UserViewDto>(createdUsers)
      .sort({ [query.sortBy]: query.sortDirection })
      .skip(query.calculateSkip())
      .limit(query.pageSize)
      .getResult();

    // 🔸 Проверяем структуру ответа сервера с учетом заданных параметров
    expect(resGetUsers.body).toEqual({
      pagesCount: 4,
      page: 2,
      pageSize: 3,
      totalCount: 12,
      items: filteredCreatedUsers,
    });
    // 🔸 Проверяем, что на запрошенной странице отображается 3 пользователя
    expect(resGetUsers.body.items.length).toEqual(3);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resGetUsers.body,
        resGetUsers.statusCode,
        'Test №2: UsersController - getUser() (GET: /users (pagination, sort, search in term))',
      );
    }
  });

  it('should use client-provided pagination values to return the correct subset of data(2).', async () => {
    // 🔻 Создаем 12 тестовых пользователей через менеджер пользователей
    const createdUsers: UserViewDto[] = await usersTestManager.createUser(12);

    // 🔻 Настраиваем параметры запроса для пагинации
    const query: GetUsersQueryParams = new GetUsersQueryParams();
    query.pageSize = 2;
    query.pageNumber = 6;
    query.sortDirection = SortDirection.Ascending;

    // 🔻 Выполняем GET-запрос с указанными параметрами
    const resGetUsers: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/sa/users`)
      .set('Authorization', adminCredentialsInBase64)
      .query(query)
      .expect(HttpStatus.OK);

    // 🔻 Применяем те же фильтрацию и сортировку к созданным пользователям
    const filteredCreatedUsers: UserViewDto[] = new Filter<UserViewDto>(createdUsers)
      .sort({ [query.sortBy]: query.sortDirection })
      .skip(query.calculateSkip())
      .limit(query.pageSize)
      .getResult();

    // 🔸 Проверяем структуру ответа сервера с учетом заданных параметров
    expect(resGetUsers.body).toEqual({
      pagesCount: 6,
      page: 6,
      pageSize: 2,
      totalCount: 12,
      items: filteredCreatedUsers,
    });
    // 🔸 Проверяем, что на запрошенной странице отображается 2 пользователя
    expect(resGetUsers.body.items.length).toEqual(2);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resGetUsers.body,
        resGetUsers.statusCode,
        'Test №3: UsersController - getUser() (GET: /users (pagination, sort, search in term))',
      );
    }
  });

  it('should use the values provided by the client to search for users by the occurrence of the substring (the  "login" field).', async () => {
    // 🔻 Создаём 12 пользователей через менеджер пользователей
    const createdUsers: UserViewDto[] = await usersTestManager.createUser(12);

    // 🔻 Устанавливаем параметр поиска по логину
    const query: GetUsersQueryParams = new GetUsersQueryParams();
    query.searchLoginTerm = 'r1'; // ожидаем, что будут найдены логины, содержащие "r1"

    // 🔻 Формируем фильтр, имитирующий серверную фильтрацию
    const searchFilter: TestSearchFilter = {
      login: query.searchLoginTerm,
    };

    // 🔻 Выполняем GET-запрос к эндпоинту /users с параметром поиска
    const resGetUsers: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/sa/users`)
      .set('Authorization', adminCredentialsInBase64)
      .query(query)
      .expect(HttpStatus.OK);

    // 🔻 Применяем к созданным пользователям такие же фильтры и сортировку, как и на сервере
    const filteredCreatedUsers: UserViewDto[] = new Filter<UserViewDto>(createdUsers)
      .filter(searchFilter) // фильтруем по вхождению "r1" в поле login
      .sort({ [query.sortBy]: query.sortDirection })
      .getResult();

    // 🔸 Проверяем, что сервер вернул корректную структуру ответа и ожидаемые данные
    expect(resGetUsers.body).toEqual({
      pagesCount: 1,
      page: 1,
      pageSize: 10,
      totalCount: 3,
      items: filteredCreatedUsers,
    });

    // 🔸 Убедимся, что было возвращено ровно 3 пользователя с нужным логином
    expect(resGetUsers.body.items.length).toEqual(3);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resGetUsers.body,
        resGetUsers.statusCode,
        'Test №4: UsersController - getUser() (GET: /users (pagination, sort, search in term))',
      );
    }
  });

  it('should use the values provided by the client to search for users by the occurrence of the substring (the "email" field).', async () => {
    // 🔻 Создаём 12 тестовых пользователей через менеджер пользователей
    const createdUsers: UserViewDto[] = await usersTestManager.createUser(12);

    // 🔻 Устанавливаем параметр поиска по email
    const query: GetUsersQueryParams = new GetUsersQueryParams();
    query.searchEmailTerm = 'r1';

    // 🔻 Формируем фильтр, имитирующий серверную фильтрацию по email
    const searchFilter: TestSearchFilter = {
      email: query.searchEmailTerm,
    };

    // 🔻 Выполняем GET-запрос с параметром поиска по email
    const resGetUsers: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/sa/users`)
      .set('Authorization', adminCredentialsInBase64)
      .query(query)
      .expect(HttpStatus.OK);

    // 🔻 Локально применяем фильтрацию и сортировку, имитируя логику на сервере
    const filteredCreatedUsers: UserViewDto[] = new Filter<UserViewDto>(createdUsers)
      .filter(searchFilter) // фильтруем по вхождению "r1" в поле email
      .sort({ [query.sortBy]: query.sortDirection })
      .getResult();

    // 🔸 Проверяем, что сервер вернул корректную структуру и правильный набор пользователей
    expect(resGetUsers.body).toEqual({
      pagesCount: 1,
      page: 1,
      pageSize: 10,
      totalCount: 3,
      items: filteredCreatedUsers,
    });

    // 🔸 Убеждаемся, что в результате — ровно 3 пользователя с подходящим email
    expect(resGetUsers.body.items.length).toEqual(3);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resGetUsers.body,
        resGetUsers.statusCode,
        'Test №5: UsersController - getUser() (GET: /users (pagination, sort, search in term))',
      );
    }
  });

  it('should use the values provided by the client to search for users by the occurrence of the substring (the "login" and "email" fields).', async () => {
    // 🔻 Создаём 12 тестовых пользователей через менеджер пользователей
    const createdUsers: UserViewDto[] = await usersTestManager.createUser(12);

    // 🔻 Устанавливаем параметры поиска по логину и email
    const query: GetUsersQueryParams = new GetUsersQueryParams();
    query.searchLoginTerm = 'r1'; // фильтрация по подстроке в login
    query.searchEmailTerm = 'r5'; // фильтрация по подстроке в email

    // 🔻 Формируем фильтр, имитирующий серверную фильтрацию по двум полям
    const searchFilter: TestSearchFilter = {
      login: query.searchLoginTerm,
      email: query.searchEmailTerm,
    };

    // 🔻 Выполняем GET-запрос с обоими параметрами поиска
    const resGetUsers: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/sa/users`)
      .set('Authorization', adminCredentialsInBase64)
      .query(query)
      .expect(HttpStatus.OK);

    // 🔻 Применяем фильтрацию и сортировку к созданным пользователям
    const filteredCreatedUsers: UserViewDto[] = new Filter<UserViewDto>(createdUsers)
      .filter(searchFilter) // фильтрация по login и email
      .sort({ [query.sortBy]: query.sortDirection })
      .getResult();

    // 🔸 Проверяем, что сервер вернул ожидаемую структуру и отфильтрованных пользователей
    expect(resGetUsers.body).toEqual({
      pagesCount: 1,
      page: 1,
      pageSize: 10,
      totalCount: 4,
      items: filteredCreatedUsers,
    });

    // 🔸 Убеждаемся, что в результате вернулось ровно 4 пользователя
    expect(resGetUsers.body.items.length).toEqual(4);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resGetUsers.body,
        resGetUsers.statusCode,
        'Test №6: UsersController - getUser() (GET: /users (pagination, sort, search in term))',
      );
    }
  });

  it('should return a 400 error if the client has passed invalid pagination values.', async () => {
    // 🔻 Создаём пользователей (необязательно для этого теста, но не помешает)
    await usersTestManager.createUser(12);

    // 🔻 Выполняем GET-запрос с заведомо некорректными значениями параметров
    const resGetUsers: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/sa/users`)
      .set('Authorization', adminCredentialsInBase64)
      .query({
        pageNumber: 'xxx', // некорректное значение — ожидается число
        pageSize: 'xxx', // некорректное значение — ожидается число
        sortBy: 123, // некорректное значение — ожидается строка из разрешённого списка
        sortDirection: 'xxx', // невалидное значение — разрешены только 'ASC' или 'DESC'
        searchLoginTerm: 123, // тип не соответствует ожидаемому (string)
        searchEmailTerm: 123, // тип не соответствует ожидаемому (string)
      })
      .expect(HttpStatus.BAD_REQUEST);

    // 🔸 Проверяем, что сервер вернул корректное тело ошибки с детальными сообщениями
    expect(resGetUsers.body).toEqual({
      errorsMessages: [
        {
          field: 'sortDirection',
          message:
            'sortDirection must be one of the following values: asc, desc; Received value: xxx',
        },
        {
          field: 'pageSize',
          message:
            'pageSize must be a number conforming to the specified constraints; Received value: NaN',
        },
        {
          field: 'pageNumber',
          message:
            'pageNumber must be a number conforming to the specified constraints; Received value: NaN',
        },
        {
          field: 'sortBy',
          message:
            'sortBy must be one of the following values: createdAt, updatedAt, deletedAt, login, email; Received value: 123',
        },
      ],
    });

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resGetUsers.body,
        resGetUsers.statusCode,
        'Test №7: UsersController - getUser() (GET: /users (pagination, sort, search in term))',
      );
    }
  });
});
