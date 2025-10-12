import request, { Response } from 'supertest';
import { Server } from 'http';
import { HttpStatus } from '@nestjs/common';
import {
  GetPostsQueryParams,
  PostsSortBy,
} from '../../src/modules/bloggers-platform/posts/api/input-dto/get-posts-query-params.input-dto';
import { AppTestManager } from '../managers/app.test-manager';
import { BlogsTestManager } from '../managers/blogs.test-manager';
import { PostsTestManager } from '../managers/posts.test-manager';
import { AdminCredentials } from '../types';
import { TestUtils } from '../helpers/test.utils';
import { PostViewDto } from '../../src/modules/bloggers-platform/posts/api/view-dto/post.view-dto';
import { Filter } from '../helpers/filter';
import { TestLoggers } from '../helpers/test.loggers';
import { SortDirection } from '../../src/core/dto/base.query-params.input-dto';
import { GLOBAL_PREFIX } from '../../src/setup/global-prefix.setup';
import { BlogViewDto } from '../../src/modules/bloggers-platform/blogs/api/view-dto/blog.view-dto';

describe('PostsController - getPost() (GET: /posts (pagination, sort, search in term))', () => {
  let appTestManager: AppTestManager;
  let blogsTestManager: BlogsTestManager;
  let postsTestManager: PostsTestManager;
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
    postsTestManager = new PostsTestManager(server, adminCredentialsInBase64);
  });

  beforeEach(async () => {
    await appTestManager.cleanupDb(['migrations']);
  });

  afterAll(async () => {
    await appTestManager.close();
  });

  it('should use default pagination values when none are provided by the client.', async () => {
    // 🔻 Создаем один блог
    const [createdBlog]: BlogViewDto[] = await blogsTestManager.createBlog(1);

    // 🔻 Создаем 12 постов, привязанных к созданному блогу
    const posts: PostViewDto[] = await postsTestManager.createPost(12, createdBlog.id);

    // 🔻 Отправляем GET-запрос на получение постов без параметров пагинации
    const resGetPosts: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/posts`)
      .expect(HttpStatus.OK);

    // 🔻 Создаем объект с дефолтными параметрами пагинации и сортировки
    const query: GetPostsQueryParams = new GetPostsQueryParams();

    // 🔻 Применяем фильтрацию, сортировку и пагинацию к ожидаемым результатам
    const filteredCreatedPosts: PostViewDto[] = new Filter<PostViewDto>(posts)
      .sort({ [query.sortBy]: query.sortDirection })
      .skip(query.calculateSkip())
      .limit(query.pageSize)
      .getResult();

    // 🔻 Проверяем структуру ответа и правильность пагинации
    expect(resGetPosts.body).toEqual({
      pagesCount: 2,
      page: 1,
      pageSize: 10,
      totalCount: 12,
      items: filteredCreatedPosts,
    });

    // 🔻 Удостоверяемся, что возвращено ровно 10 постов (дефолт pageSize)
    expect(resGetPosts.body.items).toHaveLength(10);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resGetPosts.body,
        resGetPosts.statusCode,
        'Test №1: PostsController - getPost() (GET: /posts (pagination, sort, search in term))',
      );
    }
  });

  it('should use client-provided pagination values to return the correct subset of data(1).', async () => {
    // 🔻 Создаем один блог
    const [createdBlog]: BlogViewDto[] = await blogsTestManager.createBlog(1);

    // 🔻 Создаем 12 постов, связанных с этим блогом
    const posts: PostViewDto[] = await postsTestManager.createPost(12, createdBlog.id);

    // 🔻 Формируем объект query-параметров, предоставленных клиентом
    const query: GetPostsQueryParams = new GetPostsQueryParams();
    query.sortBy = PostsSortBy.Title;
    query.sortDirection = SortDirection.Ascending;
    query.pageNumber = 2;
    query.pageSize = 3;

    // 🔻 Отправляем GET-запрос с query-параметрами
    const resGetPosts: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/posts`)
      .query(query)
      .expect(HttpStatus.OK);

    // 🔻 Фильтруем, сортируем и ограничиваем список постов для сравнения
    const filteredCreatedPosts: PostViewDto[] = new Filter<PostViewDto>(posts)
      .sort({ [query.sortBy]: query.sortDirection })
      .skip(query.calculateSkip())
      .limit(query.pageSize)
      .getResult();

    // 🔻 Проверяем, что тело ответа соответствует ожидаемым значениям
    expect(resGetPosts.body).toEqual({
      pagesCount: 4,
      page: 2,
      pageSize: 3,
      totalCount: 12,
      items: filteredCreatedPosts,
    });

    // 🔻 Проверяем, что вернулось ровно 3 поста
    expect(resGetPosts.body.items).toHaveLength(3);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resGetPosts.body,
        resGetPosts.statusCode,
        'Test №2: PostsController - getPost() (GET: /posts (pagination, sort, search in term))',
      );
    }
  });

  it('should use client-provided pagination values to return the correct subset of data(2).', async () => {
    // 🔻 Создаем один блог
    const [createdBlog]: BlogViewDto[] = await blogsTestManager.createBlog(1);

    // 🔻 Создаем 12 постов, связанных с этим блогом
    const posts: PostViewDto[] = await postsTestManager.createPost(12, createdBlog.id);

    // 🔻 Формируем объект query-параметров, предоставленных клиентом
    const query: GetPostsQueryParams = new GetPostsQueryParams();
    query.sortBy = PostsSortBy.CreatedAt;
    query.sortDirection = SortDirection.Descending;
    query.pageNumber = 6;
    query.pageSize = 2;

    // 🔻 Отправляем GET-запрос с query-параметрами
    const resGetPosts: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/posts`)
      .query(query)
      .expect(HttpStatus.OK);

    // 🔻 Фильтруем, сортируем и ограничиваем список постов для сравнения
    const filteredCreatedPosts: PostViewDto[] = new Filter<PostViewDto>(posts)
      .sort({ [query.sortBy]: query.sortDirection })
      .skip(query.calculateSkip())
      .limit(query.pageSize)
      .getResult();

    // 🔻 Проверяем, что тело ответа соответствует ожидаемым значениям
    expect(resGetPosts.body).toEqual({
      pagesCount: 6,
      page: 6,
      pageSize: 2,
      totalCount: 12,
      items: filteredCreatedPosts,
    });

    // 🔻 Проверяем, что вернулось ровно 2 поста
    expect(resGetPosts.body.items).toHaveLength(2);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resGetPosts.body,
        resGetPosts.statusCode,
        'Test №3: PostsController - getPost() (GET: /posts (pagination, sort, search in term))',
      );
    }
  });

  it('should use client-provided pagination values to return the correct subset of data(3).', async () => {
    // 🔻 Создаем один блог
    const [createdBlog]: BlogViewDto[] = await blogsTestManager.createBlog(1);

    // 🔻 Создаем 12 постов, связанных с этим блогом
    const posts: PostViewDto[] = await postsTestManager.createPost(12, createdBlog.id);

    // 🔻 Формируем объект query-параметров с пользовательскими значениями
    const query: GetPostsQueryParams = new GetPostsQueryParams();
    query.sortBy = PostsSortBy.Title;
    query.sortDirection = SortDirection.Descending;
    query.pageNumber = 2;
    query.pageSize = 1;

    // 🔻 Отправляем GET-запрос на получение постов с указанными параметрами
    const resGetPosts: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/posts`)
      .query(query)
      .expect(HttpStatus.OK);

    // 🔻 Формируем ожидаемый результат: сортируем, пропускаем и ограничиваем исходный массив
    const filteredCreatedPosts: PostViewDto[] = new Filter<PostViewDto>(posts)
      .sort({ [query.sortBy]: query.sortDirection })
      .skip(query.calculateSkip())
      .limit(query.pageSize)
      .getResult();

    // 🔻 Проверяем тело ответа на соответствие ожидаемым данным
    expect(resGetPosts.body).toEqual({
      pagesCount: 12,
      page: 2,
      pageSize: 1,
      totalCount: 12,
      items: filteredCreatedPosts,
    });

    // 🔻 Проверяем, что вернулся ровно 1 пост
    expect(resGetPosts.body.items).toHaveLength(1);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resGetPosts.body,
        resGetPosts.statusCode,
        'Test №4: PostsController - getPost() (GET: /posts (pagination, sort, search in term))',
      );
    }
  });

  // TODO: дописать тест!!!

  // it.only('should use client-provided pagination values to return the correct subset of data(3).', async () => {
  //   const blogs: BlogViewDto[] = await blogsTestManager.createBlog(12);
  //   const posts: PostViewDto[] = [];
  //   const dtos: PostInputDto[] = TestDtoFactory.generatePostInputDto(blogs.length * 5);
  //
  //   for (let i = 0; i < blogs.length; i++) {
  //     for (let j = 0; j < 5; j++) {
  //       const types: PostInputDto = dtos[j];
  //
  //       const response: Response = await request(server)
  //         .post(`/${GLOBAL_PREFIX}/sa/blogs/${blogs[i].id}/posts`)
  //         .send(types)
  //         .set('Authorization', adminCredentialsInBase64)
  //         .expect(HttpStatus.CREATED);
  //
  //       posts.push(response.body);
  //     }
  //   }
  //
  //   const query: GetPostsQueryParams = new GetPostsQueryParams();
  //   query.sortBy = PostsSortBy.BlogName;
  //   query.sortDirection = SortDirection.Descending;
  //   query.pageNumber = 2;
  //   query.pageSize = 5;
  //
  //   const resGetPosts: Response = await request(server)
  //     .get(`/${GLOBAL_PREFIX}/posts`)
  //     .query(query)
  //     .expect(HttpStatus.OK);
  //
  //   const filteredCreatedPosts: PostViewDto[] = new Filter<PostViewDto>(posts)
  //     .sort({ [query.sortBy]: query.sortDirection })
  //     .skip(query.calculateSkip())
  //     .limit(query.pageSize)
  //     .getResult();
  //
  //   console.log(resGetPosts.body);
  //   console.log(filteredCreatedPosts);
  //   // expect(resGetPosts.body).toEqual({
  //   //   pagesCount: 12,
  //   //   page: 2,
  //   //   pageSize: 5,
  //   //   totalCount: 60,
  //   //   items: filteredCreatedPosts,
  //   // });
  //
  //   // expect(resGetPosts.body.items).toHaveLength(1);
  //   //
  //   // if (testLoggingEnabled) {
  //   //   TestLoggers.logE2E(
  //   //     resGetPosts.body,
  //   //     resGetPosts.statusCode,
  //   //     'Test №4: PostsController - getPost() (GET: /posts (pagination, sort, search in term))',
  //   //   );
  //   // }
  // });

  it('should return a 400 error if the client has passed invalid pagination values.', async () => {
    // 🔻 Создаем блог и создаем 12 постов для него
    const [createdBlog]: BlogViewDto[] = await blogsTestManager.createBlog(1);
    await postsTestManager.createPost(12, createdBlog.id);

    // 🔻 Отправляем GET-запрос с некорректными параметрами пагинации и сортировки
    const resGetPosts: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/posts`)
      .query({
        pageNumber: 'xxx',
        pageSize: 'xxx',
        sortBy: 123,
        sortDirection: 'xxx',
      })
      .expect(HttpStatus.BAD_REQUEST);

    // 🔻 Проверяем, что сервер вернул ошибки валидации по каждому полю
    expect(resGetPosts.body).toEqual({
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
            'sortBy must be one of the following values: createdAt, updatedAt, deletedAt, title, blogId, blogName; Received value: 123',
        },
      ],
    });

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resGetPosts.body,
        resGetPosts.statusCode,
        'Test №5: PostsController - getPost() (GET: /posts (pagination, sort, search in term))',
      );
    }
  });
});
