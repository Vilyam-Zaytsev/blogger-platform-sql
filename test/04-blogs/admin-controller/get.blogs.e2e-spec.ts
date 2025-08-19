import request, { Response } from 'supertest';
import { GLOBAL_PREFIX } from '../../../src/setup/global-prefix.setup';
import { TestLoggers } from '../../helpers/test.loggers';
import { AppTestManager } from '../../managers/app.test-manager';
import { AdminCredentials } from '../../types';
import { Server } from 'http';
import { BlogViewDto } from 'src/modules/bloggers-platform/blogs/api/view-dto/blog-view.dto';
import { HttpStatus } from '@nestjs/common';
import { Filter } from '../../helpers/filter';
import { GetBlogsQueryParams } from '../../../src/modules/bloggers-platform/blogs/api/input-dto/get-blogs-query-params.input-dto';
import { TestUtils } from '../../helpers/test.utils';
import { BlogsTestManager } from '../../managers/blogs.test-manager';

describe('BlogsAdminController - getBlogs() (GET: /sa/blogs)', () => {
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

  it('should return an empty array.', async () => {
    // 🔻 Отправляем GET-запрос на получение списка блогов с авторизацией администратора
    const resGetBlogs: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/sa/blogs`)
      .set('Authorization', adminCredentialsInBase64)
      .expect(HttpStatus.OK);

    // 🔸 Ожидаем, что ответ содержит пустой список блогов с нулевыми значениями пагинации
    expect(resGetBlogs.body).toEqual({
      pagesCount: 0,
      page: 1,
      pageSize: 10,
      totalCount: 0,
      items: [],
    });

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resGetBlogs.body,
        resGetBlogs.statusCode,
        'Test №1: BlogsAdminController - getBlogs() (GET: /sa/blogs)',
      );
    }
  });

  it('should return an array with a single blog.', async () => {
    // 🔻 Создаем один блог через менеджер тестов
    const blogs: BlogViewDto[] = await blogsTestManager.createBlog(1);

    // 🔻 Отправляем GET-запрос на получение списка блогов с авторизацией администратора
    const resGetBlogs: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/sa/blogs`)
      .set('Authorization', adminCredentialsInBase64)
      .expect(HttpStatus.OK);

    // 🔸 Ожидаем, что в ответе придет массив с одним блогом и корректными параметрами пагинации
    expect(resGetBlogs.body).toEqual({
      pagesCount: 1,
      page: 1,
      pageSize: 10,
      totalCount: 1,
      items: blogs,
    });

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resGetBlogs.body,
        resGetBlogs.statusCode,
        'Test №2: BlogsAdminController - getBlogs() (GET: /sa/blogs)',
      );
    }
  });

  it('should return an array with a three blogs.', async () => {
    // 🔻 Создаем три блога через менеджер тестов
    const blogs: BlogViewDto[] = await blogsTestManager.createBlog(3);

    // 🔻 Отправляем GET-запрос на получение списка блогов с авторизацией администратора
    const resGetBlogs: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/sa/blogs`)
      .set('Authorization', adminCredentialsInBase64)
      .expect(HttpStatus.OK);

    // 🔻 Формируем объект запроса с параметрами пагинации и сортировки по умолчанию
    const query: GetBlogsQueryParams = new GetBlogsQueryParams();

    // 🔸 Фильтруем и сортируем созданные блоги согласно параметрам запроса
    const filteredCreatedBlogs: BlogViewDto[] = new Filter<BlogViewDto>(blogs)
      .sort({ [query.sortBy]: query.sortDirection })
      .getResult();

    // 🔸 Проверяем, что в ответе пришли отсортированные блоги
    expect(resGetBlogs.body.items).toEqual(filteredCreatedBlogs);

    // 🔸 Проверяем, что длина массива равна 3
    expect(resGetBlogs.body.items.length).toEqual(3);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resGetBlogs.body,
        resGetBlogs.statusCode,
        'Test №3: BlogsAdminController - getBlogs() (GET: /sa/blogs)',
      );
    }
  });

  it('should not return a list of blogs if the admin is not logged in.', async () => {
    // 🔻 Создаем один блог через менеджер тестов для проверки наличия данных в базе
    await blogsTestManager.createBlog(1);

    // 🔻 Отправляем GET-запрос на получение списка блогов с некорректными учетными данными администратора
    const resGetBlog: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/sa/blogs`)
      .set('Authorization', 'incorrect admin credentials')
      .expect(HttpStatus.UNAUTHORIZED);

    // 🔸 Проверяем, что сервер ответил статусом 401 Unauthorized, т.е. доступ запрещен

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resGetBlog.body,
        resGetBlog.statusCode,
        'Test №4: BlogsAdminController - getBlogs() (GET: /sa/blogs)',
      );
    }
  });
});
