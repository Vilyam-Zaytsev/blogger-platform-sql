import request, { Response } from 'supertest';
import { TestUtils } from '../../helpers/test.utils';
import { TestDtoFactory } from '../../helpers/test.dto-factory';
import { GLOBAL_PREFIX } from '../../../src/setup/global-prefix.setup';
import { TestLoggers } from '../../helpers/test.loggers';
import { AppTestManager } from '../../managers/app.test-manager';
import { AdminCredentials } from '../../types';
import { Server } from 'http';
import { BlogInputDto } from '../../../src/modules/bloggers-platform/blogs/api/input-dto/blog-input.dto';
import { BlogViewDto } from 'src/modules/bloggers-platform/blogs/api/view-dto/blog-view.dto';
import { HttpStatus } from '@nestjs/common';
import { BlogsTestManager } from '../../managers/blogs.test-manager';
import { PaginatedViewDto } from '../../../src/core/dto/paginated.view-dto';

describe('BlogsAdminController - createBlog() (POST: /sa/blogs)', () => {
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

  it('should create a new blog if the admin is authenticated.', async () => {
    // 🔻 Генерируем входные данные (DTO) для блога
    const [dto]: BlogInputDto[] = TestDtoFactory.generateBlogInputDto(1);

    // 🔻 Отправляем запрос на создание блога от имени администратора
    const resCreateBlog: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/sa/blogs`)
      .send(dto)
      .set('Authorization', adminCredentialsInBase64)
      .expect(HttpStatus.CREATED);

    // 🔸 Проверяем, что тело ответа соответствует ожидаемому формату
    expect(resCreateBlog.body).toEqual({
      id: expect.any(String),
      name: dto.name,
      description: dto.description,
      websiteUrl: dto.websiteUrl,
      createdAt: expect.stringMatching(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      ),
      isMembership: false,
    });

    // 🔻 Делаем GET-запрос /sa/blogs/{id}, чтобы убедиться, что блог действительно создан
    const createdBlog: BlogViewDto = await blogsTestManager.getById(
      resCreateBlog.body.id,
    );

    // 🔸 Сравниваем, что данные из ответа при создании совпадают с данными из GET-запроса
    expect(resCreateBlog.body).toEqual(createdBlog);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resCreateBlog.body,
        resCreateBlog.statusCode,
        'Test №1: BlogsAdminController - createBlog() (POST: /sa/blogs)',
      );
    }
  });

  it('should not create a blog if the admin is not authenticated.', async () => {
    // 🔻 Генерируем входные данные (DTO) для блога
    const [dto]: BlogInputDto[] = TestDtoFactory.generateBlogInputDto(1);

    // 🔻 Пытаемся создать блог с некорректными данными для авторизации
    const resCreateBlog: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/sa/blogs`)
      .send({
        name: dto.name,
        description: dto.description,
        websiteUrl: dto.websiteUrl,
      })
      .set('Authorization', 'incorrect admin credentials') // намеренно некорректные креденшлы
      .expect(HttpStatus.UNAUTHORIZED);

    // 🔻 Получаем список блогов через GET-запрос
    const { items: blogs }: PaginatedViewDto<BlogViewDto> =
      await blogsTestManager.getAll();

    // 🔸 Проверяем, что блог не был создан
    expect(blogs).toHaveLength(0);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resCreateBlog.body,
        resCreateBlog.statusCode,
        'Test №2: BlogsAdminController - createBlog() (POST: /sa/blogs)',
      );
    }
  });

  it('should not create a blog if the data in the request body is incorrect (an empty object is passed).', async () => {
    // 🔻 Пытаемся создать блог с пустым объектом в теле запроса
    const resCreateBlog: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/sa/blogs`)
      .send({})
      .set('Authorization', adminCredentialsInBase64)
      .expect(HttpStatus.BAD_REQUEST);

    // 🔸 Проверяем, что сервер вернул ожидаемые ошибки валидации
    expect(resCreateBlog.body).toEqual({
      errorsMessages: [
        {
          field: 'websiteUrl',
          message:
            'websiteUrl must match /^https:\\/\\/([a-zA-Z0-9_-]+\\.)+[a-zA-Z0-9_-]+(\\/[a-zA-Z0-9_-]+)*\\/?$/ regular expression; Received value: undefined',
        },
        {
          field: 'description',
          message: 'description must be a string; Received value: undefined',
        },
        {
          field: 'name',
          message: 'name must be a string; Received value: undefined',
        },
      ],
    });

    // 🔻 Получаем список блогов через GET-запрос
    const { items: blogs }: PaginatedViewDto<BlogViewDto> =
      await blogsTestManager.getAll();

    // 🔸 Убеждаемся, что блог не был создан
    expect(blogs).toHaveLength(0);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resCreateBlog.body,
        resCreateBlog.statusCode,
        'Test №3: BlogsAdminController - createBlog() (POST: /sa/blogs)',
      );
    }
  });

  it('should not create a blog if the data in the request body is incorrect (name: empty line, description: empty line, website Url: empty line).', async () => {
    // 🔻 Пытаемся создать блог, передав в теле запроса строки, состоящие только из пробелов
    const resCreateBlog: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/sa/blogs`)
      .send({
        name: '   ',
        description: '   ',
        websiteUrl: '   ',
      })
      .set('Authorization', adminCredentialsInBase64)
      .expect(HttpStatus.BAD_REQUEST);

    // 🔸 Проверяем, что сервер вернул корректные ошибки валидации
    expect(resCreateBlog.body).toEqual({
      errorsMessages: [
        {
          field: 'websiteUrl',
          message:
            'websiteUrl must match /^https:\\/\\/([a-zA-Z0-9_-]+\\.)+[a-zA-Z0-9_-]+(\\/[a-zA-Z0-9_-]+)*\\/?$/ regular expression; Received value: ',
        },
        {
          field: 'description',
          message:
            'description must be longer than or equal to 1 characters; Received value: ',
        },
        {
          field: 'name',
          message:
            'name must be longer than or equal to 1 characters; Received value: ',
        },
      ],
    });

    // 🔻 Получаем список блогов через GET-запрос
    const { items: blogs }: PaginatedViewDto<BlogViewDto> =
      await blogsTestManager.getAll();

    // 🔸 Убеждаемся, что блог не был создан
    expect(blogs).toHaveLength(0);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resCreateBlog.body,
        resCreateBlog.statusCode,
        'Test №4: BlogsAdminController - createBlog() (POST: /sa/blogs)',
      );
    }
  });

  it('should not create a blog if the data in the request body is incorrect (name: exceeds max length, description: exceeds max length, website Url: exceeds max length).', async () => {
    // 🔻 Генерируем данные, которые превышают допустимые ограничения:
    const name: string = TestUtils.generateRandomString(16);
    const description: string = TestUtils.generateRandomString(501);
    const websiteUrl: string = TestUtils.generateRandomString(101);

    // 🔻 Пытаемся создать блог с некорректными данными
    const resCreateBlog: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/sa/blogs`)
      .send({
        name,
        description,
        websiteUrl,
      })
      .set('Authorization', adminCredentialsInBase64)
      .expect(HttpStatus.BAD_REQUEST);

    // 🔸 Проверяем, что сервер вернул ошибки валидации по всем полям
    expect(resCreateBlog.body).toEqual({
      errorsMessages: [
        {
          field: 'websiteUrl',
          message:
            'websiteUrl must match /^https:\\/\\/([a-zA-Z0-9_-]+\\.)+[a-zA-Z0-9_-]+(\\/[a-zA-Z0-9_-]+)*\\/?$/' +
            ` regular expression; Received value: ${websiteUrl}`,
        },
        {
          field: 'description',
          message: `description must be shorter than or equal to 500 characters; Received value: ${description}`,
        },
        {
          field: 'name',
          message: `name must be shorter than or equal to 15 characters; Received value: ${name}`,
        },
      ],
    });

    // 🔻 Запрашиваем список блогов через GET-запрос
    const { items: blogs }: PaginatedViewDto<BlogViewDto> =
      await blogsTestManager.getAll();

    // 🔸 Убеждаемся, что блог не был создан
    expect(blogs).toHaveLength(0);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resCreateBlog.body,
        resCreateBlog.statusCode,
        'Test №5: BlogsAdminController - createBlog() (POST: /sa/blogs)',
      );
    }
  });

  it('should not create a blog if the data in the request body is incorrect (name: type number, description: type number, website Url: type number).', async () => {
    // 🔻 Отправляем некорректные данные:
    const resCreateBlog: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/sa/blogs`)
      .send({
        name: 123,
        description: 123,
        websiteUrl: 123,
      })
      .set('Authorization', adminCredentialsInBase64)
      .expect(HttpStatus.BAD_REQUEST);

    // 🔸 Проверяем, что сервер вернул ошибки валидации по всем полям
    expect(resCreateBlog.body).toEqual({
      errorsMessages: [
        {
          field: 'websiteUrl',
          message:
            'websiteUrl must match /^https:\\/\\/([a-zA-Z0-9_-]+\\.)+[a-zA-Z0-9_-]+(\\/[a-zA-Z0-9_-]+)*\\/?$/' +
            ` regular expression; Received value: 123`,
        },
        {
          field: 'description',
          message: `description must be a string; Received value: 123`,
        },
        {
          field: 'name',
          message: `name must be a string; Received value: 123`,
        },
      ],
    });

    // 🔻 Запрашиваем список блогов через GET-запрос
    const { items: blogs }: PaginatedViewDto<BlogViewDto> =
      await blogsTestManager.getAll();

    // 🔸 Убеждаемся, что блог не был создан
    expect(blogs).toHaveLength(0);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resCreateBlog.body,
        resCreateBlog.statusCode,
        'Test №6: BlogsAdminController - createBlog() (POST: /sa/blogs)',
      );
    }
  });

  it('should not create a blog if the data in the request body is incorrect (invalid url).', async () => {
    // 🔻 Генерируем корректные данные блога, но портим поле websiteUrl
    const [dto]: BlogInputDto[] = TestDtoFactory.generateBlogInputDto(1);
    dto.websiteUrl = 'incorrect websiteUrl';

    // 🔻 Пытаемся создать блог с некорректным URL
    const resCreateBlog: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/sa/blogs`)
      .send(dto)
      .set('Authorization', adminCredentialsInBase64)
      .expect(HttpStatus.BAD_REQUEST);

    // 🔸 Проверяем, что вернулась ошибка валидации только по websiteUrl
    expect(resCreateBlog.body).toEqual({
      errorsMessages: [
        {
          field: 'websiteUrl',
          message:
            'websiteUrl must match /^https:\\/\\/([a-zA-Z0-9_-]+\\.)+[a-zA-Z0-9_-]+(\\/[a-zA-Z0-9_-]+)*\\/?$/' +
            ` regular expression; Received value: ${dto.websiteUrl}`,
        },
      ],
    });

    // 🔻 Получаем список блогов через GET-запрос
    const { items: blogs }: PaginatedViewDto<BlogViewDto> =
      await blogsTestManager.getAll();

    // 🔸 Убеждаемся, что блог не был создан
    expect(blogs).toHaveLength(0);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resCreateBlog.body,
        resCreateBlog.statusCode,
        'Test №7: BlogsAdminController - createBlog() (POST: /sa/blogs)',
      );
    }
  });
});
