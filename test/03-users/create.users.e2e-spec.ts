import request, { Response } from 'supertest';
import { Server } from 'http';
import { HttpStatus } from '@nestjs/common';
import { AppTestManager } from '../managers/app.test-manager';
import { AdminCredentials } from '../types';
import { UserInputDto } from '../../src/modules/user-accounts/users/api/input-dto/user.input-dto';
import { GLOBAL_PREFIX } from '../../src/setup/global-prefix.setup';
import { PaginatedViewDto } from '../../src/core/dto/paginated.view-dto';
import { UsersTestManager } from '../managers/users.test-manager';
import { TestDtoFactory } from '../helpers/test.dto-factory';
import { TestUtils } from '../helpers/test.utils';
import { TestLoggers } from '../helpers/test.loggers';
import { UserViewDto } from '../../src/modules/user-accounts/users/api/view-dto/user.view-dto';

describe('UsersController - createUser() (POST: /sa/users)', () => {
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

  it('should create a new user, the admin is authenticated.', async () => {
    // 🔻 Создаем тестовые данные для нового пользователя
    const [dto]: UserInputDto[] = TestDtoFactory.generateUserInputDto(1);

    // 🔻 Отправляем POST-запрос на создание пользователя
    const resCreateUser: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/sa/users`)
      .send(dto)
      .set('Authorization', adminCredentialsInBase64)
      .expect(HttpStatus.CREATED);

    // 🔸 Проверяем корректность ответа сервера
    expect(resCreateUser.body).toEqual({
      id: expect.any(String),
      email: dto.email,
      login: dto.login,
      createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
    });

    // 🔻 Получаем список всех пользователей из базы данных
    const users: PaginatedViewDto<UserViewDto> = await usersTestManager.getAll();

    // 🔸 Проверяем, что в базе появился ровно один новый пользователь
    expect(users.items).toHaveLength(1);

    // 🔸 Проверяем соответствие созданного пользователя данным из ответа сервера
    expect(users.items[0]).toEqual(resCreateUser.body);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resCreateUser.body,
        resCreateUser.statusCode,
        'Test №1: UsersController - createUser() (POST: /sa/users)',
      );
    }
  });

  it('should not create a user if the admin is not authenticated.', async () => {
    // 🔻 Создаем тестовые данные для нового пользователя
    const [dto]: UserInputDto[] = TestDtoFactory.generateUserInputDto(1);

    // 🔻 Отправляем POST-запрос на создание пользователя с некорректными правами доступа
    const resCreateUser: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/sa/users`)
      .send(dto)
      .set('Authorization', 'incorrect admin credentials')
      .expect(HttpStatus.UNAUTHORIZED);

    // 🔻 Получаем список всех пользователей из базы данных
    const users: PaginatedViewDto<UserViewDto> = await usersTestManager.getAll();

    // 🔸 Проверяем, что в базе не появилось новых пользователей
    expect(users.items).toHaveLength(0);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resCreateUser.body,
        resCreateUser.statusCode,
        'Test №2: UsersController - createUser() (POST: /users)',
      );
    }
  });

  it('should not create a user if the data in the request body is incorrect (an empty object is passed).', async () => {
    // 🔻 Отправляем POST-запрос на создание пользователя с пустым объектом в теле запроса
    const resCreateUser: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/sa/users`)
      .send({})
      .set('Authorization', adminCredentialsInBase64)
      .expect(HttpStatus.BAD_REQUEST);

    // 🔸 Проверяем, что сервер вернул корректные сообщения об ошибках
    expect(resCreateUser.body).toEqual({
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

    // 🔻 Получаем список всех пользователей из базы данных
    const users: PaginatedViewDto<UserViewDto> = await usersTestManager.getAll();

    // 🔸 Проверяем, что в базе не появилось новых пользователей
    expect(users.items).toHaveLength(0);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resCreateUser.body,
        resCreateUser.statusCode,
        'Test №3: UsersController - createUser() (POST: /users)',
      );
    }
  });

  it('should not create a user if the data in the request body is incorrect (login: empty line, email: empty line, password: empty line).', async () => {
    // 🔻 Отправляем POST-запрос на создание пользователя с некорректно заполненными полям
    const resCreateUser: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/sa/users`)
      .send({
        login: '   ',
        email: '   ',
        password: '   ',
      })
      .set('Authorization', adminCredentialsInBase64)
      .expect(HttpStatus.BAD_REQUEST);

    // 🔸 Проверяем, что сервер вернул корректные сообщения об ошибках валидации
    expect(resCreateUser.body).toEqual({
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

    // 🔻 Получаем список всех пользователей из базы данных
    const users: PaginatedViewDto<UserViewDto> = await usersTestManager.getAll();

    // 🔸 Проверяем, что в базе не появилось новых пользователей
    expect(users.items).toHaveLength(0);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resCreateUser.body,
        resCreateUser.statusCode,
        'Test №4: UsersController - createUser() (POST: /users)',
      );
    }
  });

  it('should not create a user if the data in the request body is incorrect (login: less than the minimum length, email: incorrect, password: less than the minimum length', async () => {
    // 🔻 Генерируем случайные значения для полей, которые не соответствуют требованиям валидации
    const login: string = TestUtils.generateRandomString(2);
    const email: string = TestUtils.generateRandomString(10);
    const password: string = TestUtils.generateRandomString(5);

    // 🔻 Отправляем POST-запрос на создание пользователя с некорректно сгенерированными данными
    const resCreateUser: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/sa/users`)
      .send({
        login,
        email,
        password,
      })
      .set('Authorization', adminCredentialsInBase64)
      .expect(HttpStatus.BAD_REQUEST);

    // 🔸 Проверяем, что сервер вернул корректные сообщения об ошибках валидации
    expect(resCreateUser.body).toEqual({
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

    // 🔻 Получаем список всех пользователей из базы данных
    const users: PaginatedViewDto<UserViewDto> = await usersTestManager.getAll();

    // 🔸 Проверяем, что в базе не появилось новых пользователей
    expect(users.items).toHaveLength(0);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resCreateUser.body,
        resCreateUser.statusCode,
        'Test №5: UsersController - createUser() (POST: /users)',
      );
    }
  });

  it('should not create a user if the data in the request body is incorrect (login: exceeds max length,  email: incorrect, password: exceeds max length).', async () => {
    // 🔻 Генерируем случайные значения для полей, которые не соответствуют требованиям валидации
    const login: string = TestUtils.generateRandomString(11);
    const email: string = TestUtils.generateRandomString(10);
    const password: string = TestUtils.generateRandomString(21);

    // 🔻 Отправляем POST-запрос на создание пользователя с некорректно сгенерированными данными
    const resCreateUser: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/sa/users`)
      .send({
        login,
        email,
        password,
      })
      .set('Authorization', adminCredentialsInBase64)
      .expect(HttpStatus.BAD_REQUEST);

    // 🔸 Проверяем, что сервер вернул корректные сообщения об ошибках валидации
    expect(resCreateUser.body).toEqual({
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

    // 🔻 Получаем список всех пользователей из базы данных
    const users: PaginatedViewDto<UserViewDto> = await usersTestManager.getAll();

    // 🔸 Проверяем, что в базе не появилось новых пользователей
    expect(users.items).toHaveLength(0);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resCreateUser.body,
        resCreateUser.statusCode,
        'Test №6: UsersController - createUser() (POST: /users)',
      );
    }
  });

  it('should not create a user if the data in the request body is incorrect (login: type number,  email: type number, password: type number).', async () => {
    // 🔻 Отправляем POST-запрос на создание пользователя с некорректными типами данных (числа вместо строк)
    const resCreateUser: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/sa/users`)
      .send({
        login: 123,
        email: 123,
        password: 123,
      })
      .set('Authorization', adminCredentialsInBase64)
      .expect(HttpStatus.BAD_REQUEST);

    // 🔸 Проверяем, что сервер вернул корректные сообщения об ошибках типов данных
    expect(resCreateUser.body).toEqual({
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

    // 🔻 Получаем список всех пользователей из базы данных
    const users: PaginatedViewDto<UserViewDto> = await usersTestManager.getAll();

    // 🔸 Проверяем, что в базе не появилось новых пользователей
    expect(users.items).toHaveLength(0);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resCreateUser.body,
        resCreateUser.statusCode,
        'Test №7: UsersController - createUser() (POST: /users)',
      );
    }
  });
});
