import { AppTestManager } from '../managers/app.test-manager';
import { UsersTestManager } from '../managers/users.test-manager';
import { AdminCredentials } from '../types';
import { Server } from 'http';
import request, { Response } from 'supertest';
import { GLOBAL_PREFIX } from '../../src/setup/global-prefix.setup';
import { TestUtils } from '../helpers/test.utils';
import { PaginatedViewDto } from '../../src/core/dto/paginated.view-dto';
import { TestLoggers } from '../helpers/test.loggers';
import { HttpStatus } from '@nestjs/common';
import { UserViewDto } from '../../src/modules/user-accounts/users/api/view-dto/user.view-dto';

describe('UsersController - deleteUser() (DELETE: /users)', () => {
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

  it('should delete user, the admin is authenticated.', async () => {
    // 🔻 Создаем тестового пользователя через менеджер пользователей
    const [createdUser]: UserViewDto[] = await usersTestManager.createUser(1);

    // 🔻 Получаем список всех пользователей после создания
    const users_1: PaginatedViewDto<UserViewDto> =
      await usersTestManager.getAll();
    // 🔸 Проверяем, что в базе появился один пользователь
    expect(users_1.items).toHaveLength(1);

    // 🔻 Отправляем DELETE-запрос на удаление созданного пользователя
    const resDeleteUser: Response = await request(server)
      .delete(`/${GLOBAL_PREFIX}/sa/users/${createdUser.id}`)
      .set('Authorization', adminCredentialsInBase64)
      .expect(HttpStatus.NO_CONTENT);

    // 🔻 Получаем список всех пользователей после попытки удаления
    const users_2: PaginatedViewDto<UserViewDto> =
      await usersTestManager.getAll();
    // 🔸 Проверяем, что пользователь успешно удален (список пустой)
    expect(users_2.items).toHaveLength(0);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resDeleteUser.body,
        resDeleteUser.statusCode,
        'Test №1: UsersController - deleteUser() (DELETE: /users)',
      );
    }
  });

  it('should not delete user, the admin is not authenticated.', async () => {
    // 🔻 Создаем тестового пользователя через менеджер пользователей
    const [createdUser]: UserViewDto[] = await usersTestManager.createUser(1);

    // 🔻 Пытаемся удалить пользователя с некорректными правами доступа
    const resDeleteUser: Response = await request(server)
      .delete(`/${GLOBAL_PREFIX}/sa/users/${createdUser.id}`)
      .set('Authorization', 'incorrect admin credentials')
      .expect(HttpStatus.UNAUTHORIZED);

    // 🔻 Получаем список всех пользователей после попытки удаления
    const users: PaginatedViewDto<UserViewDto> =
      await usersTestManager.getAll();

    // 🔸 Проверяем, что пользователь остался в базе данных
    expect(users.items[0]).toEqual<UserViewDto>(createdUser);
    // 🔸 Проверяем, что количество пользователей не изменилось
    expect(users.items).toHaveLength(1);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resDeleteUser.body,
        resDeleteUser.statusCode,
        'Test №2: UsersController - deleteUser() (DELETE: /users)',
      );
    }
  });

  it('should return a 404 error if the user was not found by the passed ID in the parameters.', async () => {
    // 🔻 Создаем тестового пользователя через менеджер пользователей
    const [createdUser]: UserViewDto[] = await usersTestManager.createUser(1);
    // 🔻 Формируем некорректный ID пользователя для тестирования
    const incorrectUserId: number = Number(createdUser.id) + 1;

    // 🔻 Пытаемся удалить несуществующий пользователь с корректным токеном
    const resDeleteUser: Response = await request(server)
      .delete(`/${GLOBAL_PREFIX}/sa/users/${incorrectUserId}`)
      .set('Authorization', adminCredentialsInBase64)
      .expect(HttpStatus.NOT_FOUND);

    // 🔻 Получаем список всех пользователей после попытки удаления
    const users: PaginatedViewDto<UserViewDto> =
      await usersTestManager.getAll();

    // 🔸 Проверяем, что оригинальный пользователь остался в базе данных
    expect(users.items[0]).toEqual<UserViewDto>(createdUser);
    // 🔸 Проверяем, что количество пользователей не изменилось
    expect(users.items).toHaveLength(1);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resDeleteUser.body,
        resDeleteUser.statusCode,
        'Test №3: UsersController - deleteUser() (DELETE: /users)',
      );
    }
  });
});
