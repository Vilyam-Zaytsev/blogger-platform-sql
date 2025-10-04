import request, { Response } from 'supertest';
import { GLOBAL_PREFIX } from '../../../src/setup/global-prefix.setup';
import { TestLoggers } from '../../helpers/test.loggers';
import { AppTestManager } from '../../managers/app.test-manager';
import { AdminCredentials } from '../../types';
import { Server } from 'http';
import { HttpStatus } from '@nestjs/common';
import { Filter } from '../../helpers/filter';
import { SortDirection } from '../../../src/core/dto/base.query-params.input-dto';
import { TestUtils } from '../../helpers/test.utils';
import { BlogsTestManager } from '../../managers/blogs.test-manager';
import { PostsTestManager } from '../../managers/posts.test-manager';
import { PostViewDto } from '../../../src/modules/bloggers-platform/posts/api/view-dto/post.view-dto';
import {
  GetPostsQueryParams,
  PostsSortBy,
} from '../../../src/modules/bloggers-platform/posts/api/input-dto/get-posts-query-params.input-dto';
import { BlogViewDto } from '../../../src/modules/bloggers-platform/blogs/api/view-dto/blog.view-dto';

describe('BlogsPublicController - getPostsForBlog() (GET: /blogs/{blogId}/posts)', () => {
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
    await appTestManager.cleanupDb(['schema_migrations']);
  });

  afterAll(async () => {
    await appTestManager.close();
  });

  it('should return all posts from a specific blog.', async () => {
    // 🔻 Создаем один тестовый блог, к которому будут относиться создаваемые посты
    const [blog]: BlogViewDto[] = await blogsTestManager.createBlog(1);

    // 🔻 Создаем 3 поста, привязанных к вышеуказанному блогу
    const posts: PostViewDto[] = await postsTestManager.createPost(3, blog.id);

    // 🔻 Выполняем GET-запрос к ручке получения всех постов по конкретному блогу
    const resGetPosts: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/blogs/${blog.id}/posts`)
      .expect(HttpStatus.OK); // 🔸 Ожидаем успешный ответ 200

    // 🔻 Имитация стандартных query-параметров (по умолчанию):
    const query: GetPostsQueryParams = new GetPostsQueryParams();

    // 🔻 Применяем фильтрацию и сортировку к созданным постам так же, как это делает контроллер
    const filteredCreatedPosts: PostViewDto[] = new Filter<PostViewDto>(posts)
      .sort({ [query.sortBy]: query.sortDirection })
      .skip(query.calculateSkip())
      .limit(query.pageSize)
      .getResult();

    // 🔸 Проверяем, что структура и содержимое ответа совпадает с ожиданиями
    expect(resGetPosts.body).toEqual({
      pagesCount: 1,
      page: 1,
      pageSize: 10,
      totalCount: 3,
      items: filteredCreatedPosts,
    });

    // 🔸 Убеждаемся, что вернулось ровно 3 поста
    expect(resGetPosts.body.items).toHaveLength(3);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resGetPosts.body,
        resGetPosts.statusCode,
        'Test №1: BlogsPublicController - getPostsForBlog() (GET: /blogs/{blogId}/posts)',
      );
    }
  });

  it('should return all entries from a specific blog using the pagination values provided by the client.', async () => {
    // 🔻 Создаем один тестовый блог
    const [blog]: BlogViewDto[] = await blogsTestManager.createBlog(1);

    // 🔻 Создаем 12 постов, связанных с этим блогом
    const posts: PostViewDto[] = await postsTestManager.createPost(12, blog.id);

    // 🔻 Определяем кастомные query-параметры, которые будут переданы клиентом:
    const query: GetPostsQueryParams = new GetPostsQueryParams();
    query.sortBy = PostsSortBy.Title;
    query.sortDirection = SortDirection.Ascending;
    query.pageNumber = 2;
    query.pageSize = 3;

    // 🔻 Отправляем GET-запрос с кастомными параметрами пагинации и сортировки
    const resGetPosts: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/blogs/${blog.id}/posts`)
      .query(query)
      .expect(HttpStatus.OK);

    // 🔻 Применяем к созданным постам ту же сортировку и пагинацию, что и контроллер
    const filteredCreatedPosts: PostViewDto[] = new Filter<PostViewDto>(posts)
      .sort({ [query.sortBy]: query.sortDirection })
      .skip(query.calculateSkip())
      .limit(query.pageSize)
      .getResult();

    // 🔸 Проверяем, что ответ соответствует ожиданиям с учетом переданных query-параметров
    expect(resGetPosts.body).toEqual({
      pagesCount: 4,
      page: 2,
      pageSize: 3,
      totalCount: 12,
      items: filteredCreatedPosts,
    });

    // 🔸 Убеждаемся, что вернулось ровно 3 поста (вторая страница)
    expect(resGetPosts.body.items).toHaveLength(3);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resGetPosts.body,
        resGetPosts.statusCode,
        'Test №2: BlogsPublicController - getPostsForBlog() (GET: /blogs/{blogId}/posts)',
      );
    }
  });

  it('should return a 404 error if the blog does not exist.', async () => {
    // 🔻 Создаем один тестовый блог
    const [blog]: BlogViewDto[] = await blogsTestManager.createBlog(1);

    // 🔻 Создаем 12 постов, связанных с этим блогом
    await postsTestManager.createPost(12, blog.id);

    // 🔻 Указываем несуществующий blogId
    const incorrectBlogId: string = '1000000';

    // 🔻 Пытаемся получить посты по несуществующему блогу
    const resGetPosts_1: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/blogs/${incorrectBlogId}/posts`)
      .expect(HttpStatus.NOT_FOUND);

    // 🔻 Получаем посты по существующему блогу (контрольный запрос)
    const resGetPosts_2: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/blogs/${blog.id}/posts`)
      .expect(HttpStatus.OK);

    // 🔸 Убеждаемся, что вернулось 10 постов по умолчанию (pageSize = 10)
    expect(resGetPosts_2.body.items).toHaveLength(10);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resGetPosts_1.body,
        resGetPosts_1.statusCode,
        'Test №3: BlogsPublicController - getPostsForBlog() (GET: /blogs/{blogId}/posts)',
      );
    }
  });

  it('should return error 400 if the BlogId is not valid.', async () => {
    // 🔻 Создаем один тестовый блог
    const [blog]: BlogViewDto[] = await blogsTestManager.createBlog(1);

    // 🔻 Создаем один пост, привязанный к созданному блогу
    await postsTestManager.createPost(1, blog.id);

    // 🔸 Определяем некорректный идентификатор блога
    const invalidBlogId: string = 'a';

    // 🔻 Выполняем запрос с невалидным blogId
    const resGetPosts_1: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/blogs/${invalidBlogId}/posts`)
      .expect(HttpStatus.BAD_REQUEST);

    // 🔻 Повторяем запрос с корректным blogId для сравнения
    const resGetPosts_2: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/blogs/${blog.id}/posts`)
      .expect(HttpStatus.OK);

    // 🔸 Проверяем, что пост действительно существует (1 шт.)
    expect(resGetPosts_2.body.items).toHaveLength(1);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resGetPosts_1.body,
        resGetPosts_1.statusCode,
        'Test №4: BlogsPublicController - getPostsForBlog() (GET: /blogs/{blogId}/posts)',
      );
    }
  });
});
