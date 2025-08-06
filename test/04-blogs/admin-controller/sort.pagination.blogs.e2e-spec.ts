import request, { Response } from 'supertest';
import { GLOBAL_PREFIX } from '../../../src/setup/global-prefix.setup';
import { TestLoggers } from '../../helpers/test.loggers';
import { AppTestManager } from '../../managers/app.test-manager';
import { AdminCredentials, TestSearchFilter } from '../../types';
import { Server } from 'http';
import { BlogViewDto } from 'src/modules/bloggers-platform/blogs/api/view-dto/blog-view.dto';
import { HttpStatus } from '@nestjs/common';
import { Filter } from '../../helpers/filter';
import {
  BlogsSortBy,
  GetBlogsQueryParams,
} from '../../../src/modules/bloggers-platform/blogs/api/input-dto/get-blogs-query-params.input-dto';
import { SortDirection } from '../../../src/core/dto/base.query-params.input-dto';
import { TestUtils } from '../../helpers/test.utils';
import { BlogsTestManager } from '../../managers/blogs.test-manager';

describe('BlogsAdminController - getBlog() (GET: /sa/blogs (pagination, sort, search in term))', () => {
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

  it('should use default pagination values when none are provided by the client.', async () => {
    // 🔻 Создаём 12 блогов через менеджер тестов
    const blogs: BlogViewDto[] = await blogsTestManager.createBlog(12);

    // 🔻 Запрашиваем список блогов без передачи query-параметров пагинации
    const resGetBlogs: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/sa/blogs`)
      .set('Authorization', adminCredentialsInBase64)
      .expect(HttpStatus.OK);

    // 🔸 Создаём объект с дефолтными параметрами пагинации/сортировки
    const query: GetBlogsQueryParams = new GetBlogsQueryParams();

    // 🔸 Формируем ожидаемый результат:
    // - сортировка по умолчанию
    // - пропуск (`skip`) на основе дефолтной страницы
    // - ограничение (`limit`) на основе дефолтного pageSize
    const filteredCreatedBlogs: BlogViewDto[] = new Filter<BlogViewDto>(blogs)
      .sort({ [query.sortBy]: query.sortDirection })
      .skip(query.calculateSkip())
      .limit(query.pageSize)
      .getResult();

    // 🔻 Проверяем, что ответ соответствует ожиданиям
    expect(resGetBlogs.body).toEqual({
      pagesCount: 2,
      page: 1,
      pageSize: 10,
      totalCount: 12,
      items: filteredCreatedBlogs,
    });

    // 🔸 Уточняем, что элементов ровно 10 (дефолтный pageSize)
    expect(resGetBlogs.body.items).toHaveLength(10);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resGetBlogs.body,
        resGetBlogs.statusCode,
        'Test №1: BlogsAdminController - getBlog() (GET: /sa/blogs (pagination, sort, search in term))',
      );
    }
  });

  it('should use client-provided pagination values to return the correct subset of data(1).', async () => {
    // 🔻 Создаём 12 блогов через менеджер тестов
    const blogs: BlogViewDto[] = await blogsTestManager.createBlog(12);

    // 🔸 Устанавливаем параметры пагинации, сортировки и размера страницы, заданные клиентом
    const query: GetBlogsQueryParams = new GetBlogsQueryParams();
    query.sortBy = BlogsSortBy.Name; // сортировка по названию блога
    query.sortDirection = SortDirection.Ascending; // по возрастанию
    query.pageNumber = 2; // вторая страница
    query.pageSize = 3; // по 3 записи на страницу

    // 🔻 Запрашиваем список блогов с переданными query-параметрами
    const resGetBlogs: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/sa/blogs`)
      .set('Authorization', adminCredentialsInBase64)
      .query(query)
      .expect(HttpStatus.OK);

    // 🔸 Формируем ожидаемый результат:
    // - сортируем список созданных блогов
    // - пропускаем нужное количество элементов (skip)
    // - берём указанное количество элементов (limit)
    const filteredCreatedBlogs: BlogViewDto[] = new Filter<BlogViewDto>(blogs)
      .sort({ [query.sortBy]: query.sortDirection })
      .skip(query.calculateSkip())
      .limit(query.pageSize)
      .getResult();

    // 🔻 Проверяем, что ответ API совпадает с ожидаемым
    expect(resGetBlogs.body).toEqual({
      pagesCount: 4, // всего страниц = 12 / 3
      page: 2, // вторая страница
      pageSize: 3, // размер страницы
      totalCount: 12, // всего элементов
      items: filteredCreatedBlogs, // полученные элементы
    });

    // 🔸 Уточняем, что элементов ровно 3
    expect(resGetBlogs.body.items).toHaveLength(3);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resGetBlogs.body,
        resGetBlogs.statusCode,
        'Test №2: BlogsAdminController - getBlog() (GET: /sa/blogs (pagination, sort, search in term))',
      );
    }
  });

  it('should use client-provided pagination values to return the correct subset of data(2).', async () => {
    // 🔻 Создаём 12 блогов через менеджер тестов
    const blogs: BlogViewDto[] = await blogsTestManager.createBlog(12);

    // 🔸 Устанавливаем параметры пагинации, сортировки и размера страницы, заданные клиентом
    const query: GetBlogsQueryParams = new GetBlogsQueryParams();
    query.sortBy = BlogsSortBy.CreatedAt; // сортировка по дате создания
    query.sortDirection = SortDirection.Descending; // по убыванию (новые сверху)
    query.pageNumber = 6; // шестая страница
    query.pageSize = 2; // по 2 записи на страницу

    // 🔻 Запрашиваем список блогов с переданными query-параметрами
    const resGetBlogs: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/sa/blogs`)
      .set('Authorization', adminCredentialsInBase64)
      .query(query)
      .expect(HttpStatus.OK);

    // 🔸 Формируем ожидаемый результат:
    // - сортируем список созданных блогов
    // - пропускаем нужное количество элементов (skip)
    // - берём указанное количество элементов (limit)
    const filteredCreatedBlogs: BlogViewDto[] = new Filter<BlogViewDto>(blogs)
      .sort({ [query.sortBy]: query.sortDirection })
      .skip(query.calculateSkip())
      .limit(query.pageSize)
      .getResult();

    // 🔻 Проверяем, что ответ API совпадает с ожидаемым
    expect(resGetBlogs.body).toEqual({
      pagesCount: 6, // всего страниц = 12 / 2
      page: 6, // шестая страница
      pageSize: 2, // размер страницы
      totalCount: 12, // всего элементов
      items: filteredCreatedBlogs, // полученные элементы
    });

    // 🔸 Уточняем, что элементов ровно 2
    expect(resGetBlogs.body.items).toHaveLength(2);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resGetBlogs.body,
        resGetBlogs.statusCode,
        'Test №3: BlogsAdminController - getBlog() (GET: /sa/blogs (pagination, sort, search in term))',
      );
    }
  });

  it('should use client-provided pagination values to return the correct subset of data(3).', async () => {
    // 🔻 Создаём 12 блогов через тестовый менеджер
    const blogs: BlogViewDto[] = await blogsTestManager.createBlog(12);

    // 🔸 Задаём параметры поиска, сортировки и пагинации, переданные клиентом
    const query: GetBlogsQueryParams = new GetBlogsQueryParams();
    query.sortBy = BlogsSortBy.Name; // сортировка по названию блога
    query.sortDirection = SortDirection.Ascending; // по возрастанию (от A до Z)
    query.pageNumber = 2; // вторая страница
    query.pageSize = 1; // по одному элементу на страницу
    query.searchNameTerm = 'g1'; // фильтр по подстроке в имени блога

    // 🔸 Формируем фильтр поиска по имени
    const searchFilter: TestSearchFilter = {
      name: query.searchNameTerm,
    };

    // 🔻 Запрашиваем блоги через API с переданными query-параметрами
    const resGetBlogs: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/sa/blogs`)
      .set('Authorization', adminCredentialsInBase64)
      .query(query)
      .expect(HttpStatus.OK);

    // 🔸 Формируем ожидаемый результат:
    // - фильтруем блоги по searchTerm
    // - сортируем по имени
    // - пропускаем записи для предыдущих страниц
    // - берём указанное количество записей
    const filteredCreatedBlogs: BlogViewDto[] = new Filter<BlogViewDto>(blogs)
      .filter(searchFilter)
      .sort({ [query.sortBy]: query.sortDirection })
      .skip(query.calculateSkip())
      .limit(query.pageSize)
      .getResult();

    // 🔻 Проверяем, что ответ API соответствует ожидаемому результату
    expect(resGetBlogs.body).toEqual({
      pagesCount: 3, // всего 3 страницы (3 блога, 1 блог на страницу)
      page: 2, // вторая страница
      pageSize: 1, // размер страницы
      totalCount: 3, // всего 3 блога после фильтрации
      items: filteredCreatedBlogs, // список блогов на этой странице
    });

    // 🔸 Проверяем, что на странице ровно 1 блог
    expect(resGetBlogs.body.items).toHaveLength(1);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resGetBlogs.body,
        resGetBlogs.statusCode,
        'Test №4: BlogsAdminController - getBlog() (GET: /sa/blogs (pagination, sort, search in term))',
      );
    }
  });

  it('should return a 400 error if the client has passed invalid pagination values.', async () => {
    // 🔻 Создаём 12 блогов через тестовый менеджер
    // Нам нужны блоги, чтобы эндпоинт имел данные для работы,
    // но в данном тесте ключевое — проверить валидацию входных параметров.
    await blogsTestManager.createBlog(12);

    // 🔻 Отправляем GET-запрос на получение блогов с некорректными query-параметрами
    // pageNumber: строка вместо числа
    // pageSize: строка вместо числа
    // sortBy: число вместо строки из допустимого набора
    // sortDirection: строка, не входящая в допустимый набор ("asc" | "desc")
    // searchNameTerm: число вместо строки
    const resGetBlogs: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/sa/blogs`)
      .set('Authorization', adminCredentialsInBase64)
      .query({
        pageNumber: 'xxx',
        pageSize: 'xxx',
        sortBy: 123,
        sortDirection: 'xxx',
        searchNameTerm: 123,
      })
      .expect(HttpStatus.BAD_REQUEST);

    // 🔻 Проверяем, что сервер вернул ожидаемую структуру ошибок
    // Каждое сообщение чётко указывает на:
    // - поле, в котором ошибка
    // - что ожидается
    // - что было передано
    expect(resGetBlogs.body).toEqual({
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
            'sortBy must be one of the following values: createdAt, updatedAt, deletedAt, name; Received value: 123',
        },
      ],
    });

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resGetBlogs.body,
        resGetBlogs.statusCode,
        'Test №5: BlogsAdminController - getBlog() (GET: /sa/blogs (pagination, sort, search in term))',
      );
    }
  });

  it('should return a 401 error if the client has failed authorization.', async () => {
    // 🔻 Создаём 12 блогов через тестовый менеджер
    // Эти данные нужны только для того, чтобы запрос имел смысл,
    // но на результат теста они не влияют — проверяем именно авторизацию.
    await blogsTestManager.createBlog(12);

    // 🔻 Отправляем GET-запрос на получение блогов
    // Передаём заведомо некорректные admin credentials
    // Ожидаем, что сервер вернёт 401 Unauthorized
    const resGetBlogs: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/sa/blogs`)
      .set('Authorization', 'incorrect admin credentials')
      .expect(HttpStatus.UNAUTHORIZED);

    // 🔻 Логируем результат теста (если включено логирование)
    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resGetBlogs.body,
        resGetBlogs.statusCode,
        'Test №6: BlogsAdminController - getBlog() (GET: /sa/blogs (pagination, sort, search in term))',
      );
    }
  });
});
