import request, { Response } from 'supertest';
import { TestUtils } from '../../helpers/test.utils';
import { GLOBAL_PREFIX } from '../../../src/setup/global-prefix.setup';
import { TestLoggers } from '../../helpers/test.loggers';
import { AppTestManager } from '../../managers/app.test-manager';
import { AdminCredentials } from '../../types';
import { Server } from 'http';
import { BlogInputDto } from '../../../src/modules/bloggers-platform/blogs/api/input-dto/blog-input.dto';
import { BlogViewDto } from 'src/modules/bloggers-platform/blogs/api/view-dto/blog-view.dto';
import { HttpStatus } from '@nestjs/common';
import { BlogsTestManager } from '../../managers/blogs.test-manager';

describe('BlogsAdminController - updateBlog() (PUT: /sa/blogs)', () => {
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

  it('should update blog, the admin is authenticated.', async () => {
    // 🔻 Создаём 1 блог через тестовый менеджер
    const [createdBlog]: BlogViewDto[] = await blogsTestManager.createBlog(1);

    // 🔻 DTO с новыми данными для обновления блога
    const dto: BlogInputDto = {
      name: 'updateName',
      description: 'update description',
      websiteUrl: 'https://update.websiteUrl.com',
    };

    // 🔻 Отправляем PUT-запрос на обновление блога
    const resUpdateBlog: Response = await request(server)
      .put(`/${GLOBAL_PREFIX}/sa/blogs/${createdBlog.id}`)
      .send(dto)
      .set('Authorization', adminCredentialsInBase64)
      .expect(HttpStatus.NO_CONTENT);

    // 🔻 Получаем обновлённый блог через /sa/blogs/{id}
    const updatedBlog: BlogViewDto = await blogsTestManager.getById(
      +createdBlog.id,
    );

    // 🔻 Проверяем, что блог действительно изменился
    expect(createdBlog).not.toEqual(updatedBlog);

    // 🔻 Проверяем, что обновлённый блог содержит новые данные
    expect(updatedBlog).toEqual({
      id: expect.any(String),
      name: dto.name,
      description: dto.description,
      websiteUrl: dto.websiteUrl,
      createdAt: expect.any(String),
      isMembership: false,
    });

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resUpdateBlog.body,
        resUpdateBlog.statusCode,
        'Test №1: BlogsAdminController - updateBlog() (PUT: /sa/blogs)',
      );
    }
  });

  it('should not update the blog if the user has not been authenticated.', async () => {
    // 🔻 Создаём 1 блог через тестовый менеджер
    const [createdBlog]: BlogViewDto[] = await blogsTestManager.createBlog(1);

    // 🔻 DTO с новыми данными, которые должны были бы обновить блог
    const dto: BlogInputDto = {
      name: 'updateName',
      description: 'update description',
      websiteUrl: 'https://update.websiteUrl.com',
    };

    // 🔻 Отправляем PUT-запрос на обновление блога
    const resUpdateBlog: Response = await request(server)
      .put(`/${GLOBAL_PREFIX}/sa/blogs/${createdBlog.id}`)
      .send(dto)
      .set('Authorization', 'incorrect admin credentials')
      .expect(HttpStatus.UNAUTHORIZED);

    // 🔻 Получаем блог снова через /sa/blogs/{id}
    // Он должен остаться без изменений
    const blog: BlogViewDto = await blogsTestManager.getById(+createdBlog.id);

    // 🔻 Проверяем, что блог не изменился
    expect(createdBlog).toEqual(blog);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resUpdateBlog.body,
        resUpdateBlog.statusCode,
        'Test №2: BlogsAdminController - updateBlog() (PUT: /sa/blogs)',
      );
    }
  });

  it('should not update a blog if the data in the request body is incorrect (an empty object is passed).', async () => {
    // 🔻 Создаём 1 тестовый блог
    const [createdBlog]: BlogViewDto[] = await blogsTestManager.createBlog(1);

    // 🔻 Отправляем PUT-запрос на обновление блога
    const resUpdateBlog: Response = await request(server)
      .put(`/${GLOBAL_PREFIX}/sa/blogs/${createdBlog.id}`)
      .send({})
      .set('Authorization', adminCredentialsInBase64)
      .expect(HttpStatus.BAD_REQUEST);

    // 🔻 Проверяем, что сервер вернул ожидаемые сообщения об ошибках валидации
    expect(resUpdateBlog.body).toEqual({
      errorsMessages: [
        {
          field: 'websiteUrl',
          message:
            'websiteUrl must match /^https:\\/\\/([a-zA-Z0-9_-]+\\.)+[a-zA-Z0-9_-]+(\\/[a-zA-Z0-9_-]+)*\\/?$/' +
            ' regular expression; Received value: undefined',
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

    // 🔻 Получаем блог через /sa/blogs/{id}
    const blog: BlogViewDto = await blogsTestManager.getById(+createdBlog.id);

    // 🔻 Проверяем, что блог остался прежним
    expect(createdBlog).toEqual(blog);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resUpdateBlog.body,
        resUpdateBlog.statusCode,
        'Test №3: BlogsAdminController - updateBlog() (PUT: /sa/blogs)',
      );
    }
  });

  it('should not update a blog if the data in the request body is incorrect (name: empty line, description: empty line, website Url: empty line).', async () => {
    // 🔻 Создаём тестовый блог (1 штука)
    const [createdBlog]: BlogViewDto[] = await blogsTestManager.createBlog(1);

    // 🔻 Отправляем PUT-запрос на обновление блога
    const resUpdateBlog: Response = await request(server)
      .put(`/${GLOBAL_PREFIX}/sa/blogs/${createdBlog.id}`)
      .send({
        name: '   ',
        description: '   ',
        websiteUrl: '   ',
      })
      .set('Authorization', adminCredentialsInBase64)
      .expect(HttpStatus.BAD_REQUEST);

    // 🔻 Проверяем, что сервер вернул ожидаемые сообщения об ошибках валидации
    expect(resUpdateBlog.body).toEqual({
      errorsMessages: [
        {
          field: 'websiteUrl',
          message:
            'websiteUrl must match /^https:\\/\\/([a-zA-Z0-9_-]+\\.)+[a-zA-Z0-9_-]+(\\/[a-zA-Z0-9_-]+)*\\/?$/' +
            ' regular expression; Received value: ',
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

    // 🔻 Получаем блог через /sa/blogs/{id}
    const blog: BlogViewDto = await blogsTestManager.getById(+createdBlog.id);
    expect(createdBlog).toEqual(blog);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resUpdateBlog.body,
        resUpdateBlog.statusCode,
        'Test №4: BlogsAdminController - updateBlog() (PUT: /sa/blogs)',
      );
    }
  });

  it('should not update a blog if the data in the request body is incorrect (name: exceeds max length, description: exceeds max length, website Url: exceeds max length).', async () => {
    // 🔻 Создаём тестовый блог (1 штука)
    const [createdBlog]: BlogViewDto[] = await blogsTestManager.createBlog(1);

    // 🔻 Генерируем тестовые данные, превышающие допустимые ограничения:
    const name: string = TestUtils.generateRandomString(16);
    const description: string = TestUtils.generateRandomString(501);
    const websiteUrl: string = TestUtils.generateRandomString(101);

    // 🔻 Отправляем PUT-запрос на обновление блога
    const resUpdateBlog: Response = await request(server)
      .put(`/${GLOBAL_PREFIX}/sa/blogs/${createdBlog.id}`)
      .send({
        name,
        description,
        websiteUrl,
      })
      .set('Authorization', adminCredentialsInBase64)
      .expect(HttpStatus.BAD_REQUEST);

    // 🔻 Проверяем, что сервер вернул ожидаемые сообщения об ошибках валидации
    expect(resUpdateBlog.body).toEqual({
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

    // 🔻 Получаем блог через /sa/blogs/{id}
    const blog: BlogViewDto = await blogsTestManager.getById(+createdBlog.id);
    expect(createdBlog).toEqual(blog);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resUpdateBlog.body,
        resUpdateBlog.statusCode,
        'Test №5: BlogsAdminController - updateBlog() (PUT: /sa/blogs)',
      );
    }
  });

  it('should not update a blog if the data in the request body is incorrect (name: type number, description: type number, website Url: type number).', async () => {
    // 🔻 Создаём тестовый блог (1 штука) через blogsTestManager
    const [createdBlog]: BlogViewDto[] = await blogsTestManager.createBlog(1);

    // 🔻 Отправляем PUT-запрос на обновление блога
    const resUpdateBlog: Response = await request(server)
      .put(`/${GLOBAL_PREFIX}/sa/blogs/${createdBlog.id}`)
      .send({
        name: 123,
        description: 123,
        websiteUrl: 123,
      })
      .set('Authorization', adminCredentialsInBase64)
      .expect(HttpStatus.BAD_REQUEST);

    // 🔻 Проверяем, что сервер вернул ожидаемые ошибки валидации
    expect(resUpdateBlog.body).toEqual({
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

    // 🔻 Получаем блог через /sa/blogs/{id}
    const blog: BlogViewDto = await blogsTestManager.getById(+createdBlog.id);
    expect(createdBlog).toEqual(blog);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resUpdateBlog.body,
        resUpdateBlog.statusCode,
        'Test №6: BlogsAdminController - updateBlog() (PUT: /sa/blogs)',
      );
    }
  });

  it('should not update a blog if the data in the request body is incorrect (invalid url).', async () => {
    // 🔻 Создаём тестовый блог (1 штука) через blogsTestManager
    const [createdBlog]: BlogViewDto[] = await blogsTestManager.createBlog(1);

    // 🔻 Готовим DTO с корректными name и description, но некорректным websiteUrl
    const dto: BlogInputDto = {
      name: 'updateName',
      description: 'update description',
      websiteUrl: 'incorrect websiteUrl',
    };

    // 🔻 Отправляем PUT-запрос на обновление блога
    const resUpdateBlog: Response = await request(server)
      .put(`/${GLOBAL_PREFIX}/sa/blogs/${createdBlog.id}`)
      .send(dto)
      .set('Authorization', adminCredentialsInBase64)
      .expect(HttpStatus.BAD_REQUEST);

    // 🔻 Проверяем, что сервер вернул ожидаемую ошибку валидации по полю websiteUrl
    expect(resUpdateBlog.body).toEqual({
      errorsMessages: [
        {
          field: 'websiteUrl',
          message:
            'websiteUrl must match /^https:\\/\\/([a-zA-Z0-9_-]+\\.)+[a-zA-Z0-9_-]+(\\/[a-zA-Z0-9_-]+)*\\/?$/' +
            ` regular expression; Received value: ${dto.websiteUrl}`,
        },
      ],
    });

    // 🔻 Получаем блог через /sa/blogs/{id}
    const blog: BlogViewDto = await blogsTestManager.getById(+createdBlog.id);
    expect(createdBlog).toEqual(blog);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resUpdateBlog.body,
        resUpdateBlog.statusCode,
        'Test №7: BlogsAdminController - updateBlog() (PUT: /sa/blogs)',
      );
    }
  });

  it('should return a 404 error if the blog does not exist.', async () => {
    // 🔻 Создаём тестовый блог (чтобы убедиться, что база не пустая)
    const [createdBlog]: BlogViewDto[] = await blogsTestManager.createBlog(1);

    // 🔻 DTO с корректными данными
    const dto: BlogInputDto = {
      name: 'updateName',
      description: 'update description',
      websiteUrl: 'https://update.websiteUrl.com',
    };

    // 🔻 Используем заведомо несуществующий ID
    const incorrectId: string = '1000000';

    // 🔻 Отправляем PUT-запрос в админский роут /sa/blogs/{id}
    const resUpdateBlog: Response = await request(server)
      .put(`/${GLOBAL_PREFIX}/sa/blogs/${incorrectId}`)
      .send(dto)
      .set('Authorization', adminCredentialsInBase64)
      .expect(HttpStatus.NOT_FOUND);

    // 🔻 Получаем исходный блог через GET /sa/blogs/{id}
    const blog: BlogViewDto = await blogsTestManager.getById(+createdBlog.id);
    expect(createdBlog).toEqual(blog);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resUpdateBlog.body,
        resUpdateBlog.statusCode,
        'Test №8: BlogsAdminController - updateBlog() (PUT: /sa/blogs)',
      );
    }
  });
});
