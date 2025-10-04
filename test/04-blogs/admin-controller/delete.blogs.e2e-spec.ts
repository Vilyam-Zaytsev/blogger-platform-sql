import request, { Response } from 'supertest';
import { TestUtils } from '../../helpers/test.utils';
import { GLOBAL_PREFIX } from '../../../src/setup/global-prefix.setup';
import { TestLoggers } from '../../helpers/test.loggers';
import { AppTestManager } from '../../managers/app.test-manager';
import { AdminCredentials } from '../../types';
import { Server } from 'http';
import { PaginatedViewDto } from '../../../src/core/dto/paginated.view-dto';
import { HttpStatus } from '@nestjs/common';
import { BlogsTestManager } from '../../managers/blogs.test-manager';
import { BlogViewDto } from '../../../src/modules/bloggers-platform/blogs/api/view-dto/blog.view-dto';

describe('BlogsAdminController - deleteBlog() (DELETE: /sa/blogs)', () => {
  let appTestManager: AppTestManager;
  let blogsTestManager: BlogsTestManager;
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

    blogsTestManager = new BlogsTestManager(server, adminCredentialsInBase64);
  });

  beforeEach(async () => {
    await appTestManager.cleanupDb(['schema_migrations']);
  });

  afterAll(async () => {
    await appTestManager.close();
  });

  it('should delete blog, the admin is authenticated.', async () => {
    // 🔻 Создаём один блог для тестирования удаления
    const [blog]: BlogViewDto[] = await blogsTestManager.createBlog(1);

    // 🔻 Отправляем запрос на удаление блога с правильной авторизацией
    const resDeleteBlog: Response = await request(server)
      .delete(`/${GLOBAL_PREFIX}/sa/blogs/${blog.id}`)
      .set('Authorization', adminCredentialsInBase64)
      .expect(HttpStatus.NO_CONTENT);

    // 🔻 Запрашиваем список всех блогов после удаления
    const { items: blogs }: PaginatedViewDto<BlogViewDto> = await blogsTestManager.getAll();

    // 🔸 Проверяем, что список блогов пуст (блог успешно удалён)
    expect(blogs).toHaveLength(0);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resDeleteBlog.body,
        resDeleteBlog.statusCode,
        'Test №1: BlogsAdminController - deleteBlog() (DELETE: /sa/blogs)',
      );
    }
  });

  it('should not delete blog, the admin is not authenticated.', async () => {
    // 🔻 Создаём один блог для теста
    const [blog]: BlogViewDto[] = await blogsTestManager.createBlog(1);

    // 🔻 Пытаемся удалить блог с неверными учетными данными администратора
    const resDeleteBlog: Response = await request(server)
      .delete(`/${GLOBAL_PREFIX}/sa/blogs/${blog.id}`)
      .set('Authorization', 'incorrect admin credentials')
      .expect(HttpStatus.UNAUTHORIZED);

    // 🔻 Получаем блог из базы, чтобы проверить, что он не был удалён
    const blogs: BlogViewDto = await blogsTestManager.getById(+blog.id);

    // 🔸 Проверяем, что блог остался без изменений
    expect(blogs).toEqual(blog);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resDeleteBlog.body,
        resDeleteBlog.statusCode,
        'Test №2: BlogsAdminController - deleteBlog() (DELETE: /sa/blogs)',
      );
    }
  });

  it('should return a 404 error if the blog was not found by the passed ID in the parameters.', async () => {
    // 🔻 Создаём один блог для теста
    const [blog]: BlogViewDto[] = await blogsTestManager.createBlog(1);
    // 🔻 Используем некорректный ID для удаления
    const incorrectId: string = '1000000';

    // 🔻 Пытаемся удалить блог с некорректным ID, ожидаем 404 Not Found
    const resDeleteBlog: Response = await request(server)
      .delete(`/${GLOBAL_PREFIX}/blogs/${incorrectId}`)
      .set('Authorization', adminCredentialsInBase64)
      .expect(HttpStatus.NOT_FOUND);

    // 🔻 Получаем блог из базы, чтобы убедиться, что он остался без изменений
    const blogs: BlogViewDto = await blogsTestManager.getById(+blog.id);

    // 🔸 Проверяем, что блог остался таким же, каким был создан
    expect(blogs).toEqual(blog);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resDeleteBlog.body,
        resDeleteBlog.statusCode,
        'Test №3: BlogsAdminController - deleteBlog() (DELETE: /sa/blogs)',
      );
    }
  });
});
