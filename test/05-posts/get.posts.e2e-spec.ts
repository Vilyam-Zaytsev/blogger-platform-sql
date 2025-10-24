import request, { Response } from 'supertest';
import { TestUtils } from '../helpers/test.utils';
import { GLOBAL_PREFIX } from '../../src/setup/global-prefix.setup';
import { TestLoggers } from '../helpers/test.loggers';
import { AppTestManager } from '../managers/app.test-manager';
import { AdminCredentials } from '../types';
import { Server } from 'http';
import { BlogsTestManager } from '../managers/blogs.test-manager';
import { HttpStatus } from '@nestjs/common';
import { PostViewDto } from '../../src/modules/bloggers-platform/posts/api/view-dto/post.view-dto';
import { PostsTestManager } from '../managers/posts.test-manager';
import { GetBlogsQueryParams } from '../../src/modules/bloggers-platform/blogs/api/input-dto/get-blogs-query-params.input-dto';
import { Filter } from '../helpers/filter';
import { BlogViewDto } from '../../src/modules/bloggers-platform/blogs/api/view-dto/blog.view-dto';

describe('PostsController - getAllPosts() (GET: /posts)', () => {
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

  it('should return an empty array.', async () => {
    // 🔻 Отправляем GET-запрос на получение всех постов (пока нет ни одного)
    const resGetPosts: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/posts`)
      .expect(HttpStatus.OK);

    // 🔻 Проверяем, что возвращена пустая пагинированная структура
    expect(resGetPosts.body).toEqual({
      pagesCount: 0,
      page: 1,
      pageSize: 10,
      totalCount: 0,
      items: [],
    });

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resGetPosts.body,
        resGetPosts.statusCode,
        'Test №1: PostsController - getAllPosts() (GET: /posts)',
      );
    }
  });

  it('should return an array with a single post.', async () => {
    // 🔻 Создаём блог и один пост
    const [createdBlog]: BlogViewDto[] = await blogsTestManager.createBlog(1);
    const posts: PostViewDto[] = await postsTestManager.createPost(1, createdBlog.id);

    // 🔻 Отправляем GET-запрос на получение всех постов
    const resGetPosts: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/posts`)
      .expect(HttpStatus.OK);

    // 🔻 Проверяем, что возвращён массив из одного поста с корректной пагинацией
    expect(resGetPosts.body).toEqual({
      pagesCount: 1,
      page: 1,
      pageSize: 10,
      totalCount: 1,
      items: posts,
    });

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resGetPosts.body,
        resGetPosts.statusCode,
        'Test №2: PostsController - getAllPosts() (GET: /posts)',
      );
    }
  });

  it('should return an array with a three posts.', async () => {
    // 🔻 Создаём блог и три поста, привязанных к нему
    const [createdBlog]: BlogViewDto[] = await blogsTestManager.createBlog(1);
    const posts: PostViewDto[] = await postsTestManager.createPost(3, createdBlog.id);

    // 🔻 Отправляем GET-запрос на получение всех постов
    const resGetPosts: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/posts`)
      .expect(HttpStatus.OK);

    // 🔻 Формируем ожидаемый результат: сортируем созданные посты
    const query: GetBlogsQueryParams = new GetBlogsQueryParams();
    const filteredCreatedPosts: PostViewDto[] = new Filter<PostViewDto>(posts)
      .sort({ [query.sortBy]: query.sortDirection })
      .getResult();

    // 🔻 Проверяем, что ответ содержит именно 3 поста в корректном порядке
    expect(resGetPosts.body.items).toEqual(filteredCreatedPosts);
    expect(resGetPosts.body.items.length).toEqual(3);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resGetPosts.body,
        resGetPosts.statusCode,
        'Test №3: PostsController - getAllPosts() (GET: /posts)',
      );
    }
  });

  it('should return post found by id.', async () => {
    // 🔻 Создаём блог и пост, связанный с ним
    const [createdBlog]: BlogViewDto[] = await blogsTestManager.createBlog(1);
    const [createdPost]: PostViewDto[] = await postsTestManager.createPost(1, createdBlog.id);

    // 🔻 Отправляем GET-запрос на получение поста по id
    const resGetPost: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/posts/${createdPost.id}`)
      .expect(HttpStatus.OK);

    // 🔻 Проверяем, что тело ответа соответствует созданному посту
    expect(resGetPost.body).toEqual(createdPost);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resGetPost.body,
        resGetPost.statusCode,
        'Test №4: PostsController - getPostById() (GET: /posts/:postId)',
      );
    }
  });

  it('should return error 404 not found.', async () => {
    // 🔻 Создаём блог и один пост
    const [createdBlog]: BlogViewDto[] = await blogsTestManager.createBlog(1);
    const [createdPost]: PostViewDto[] = await postsTestManager.createPost(1, createdBlog.id);

    const incorrectId: string = '1000000';

    // 🔻 Отправляем GET-запрос с несуществующим id поста и ожидаем 404
    const resGetPost_1: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/posts/${incorrectId}`)
      .expect(HttpStatus.NOT_FOUND);

    // 🔻 Отправляем GET-запрос с корректным id поста и проверяем успешный ответ
    const resGetPost_2: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/posts/${createdPost.id}`)
      .expect(HttpStatus.OK);

    // 🔻 Убеждаемся, что ответ содержит ожидаемый пост
    expect(resGetPost_2.body).toEqual(createdPost);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resGetPost_1.body,
        resGetPost_1.statusCode,
        'Test №5: PostsController - getPostById() (GET: /posts/:postId)',
      );
    }
  });
});
