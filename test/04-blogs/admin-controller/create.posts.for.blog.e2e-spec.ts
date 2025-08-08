import request, { Response } from 'supertest';
import { TestUtils } from '../../helpers/test.utils';
import { TestDtoFactory } from '../../helpers/test.dto-factory';
import { GLOBAL_PREFIX } from '../../../src/setup/global-prefix.setup';
import { TestLoggers } from '../../helpers/test.loggers';
import { AppTestManager } from '../../managers/app.test-manager';
import { AdminCredentials } from '../../types';
import { Server } from 'http';
import { BlogViewDto } from 'src/modules/bloggers-platform/blogs/api/view-dto/blog-view.dto';
import { HttpStatus } from '@nestjs/common';
import { BlogsTestManager } from '../../managers/blogs.test-manager';
import { PostsTestManager } from '../../managers/posts.test-manager';
import { PostInputDto } from '../../../src/modules/bloggers-platform/posts/api/input-dto/post-input.dto';
import { PostViewDto } from '../../../src/modules/bloggers-platform/posts/api/view-dto/post-view.dto';
import { ReactionStatus } from '../../../src/modules/bloggers-platform/reactions/types/reaction-db.type';
import { PaginatedViewDto } from '../../../src/core/dto/paginated.view-dto';

describe('BlogsAdminController - createPost() (POST: /sa/blogs/{blogId}/posts)', () => {
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

  it('should create a new post, the admin is authenticated.', async () => {
    // 🔻 Создаем один блог, чтобы можно было привязать пост к существующему блогу
    const [createdBlog]: BlogViewDto[] = await blogsTestManager.createBlog(1);

    // 🔻 Генерируем DTO для создания поста
    const [dto]: PostInputDto[] = TestDtoFactory.generatePostInputDto(1);

    // 🔻 Отправляем POST-запрос на создание поста по URI /sa/blogs/:blogId/posts с валидным access-token
    const resCreatePosts: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/sa/blogs/${createdBlog.id}/posts`)
      .send(dto)
      .set('Authorization', adminCredentialsInBase64)
      .expect(HttpStatus.CREATED);

    // 🔸 Проверяем, что ответ соответствует ожидаемой структуре PostViewDto
    expect(resCreatePosts.body).toEqual<PostViewDto>({
      id: expect.any(String),
      title: dto.title,
      shortDescription: dto.shortDescription,
      content: dto.content,
      blogId: createdBlog.id,
      blogName: createdBlog.name,
      extendedLikesInfo: {
        likesCount: 0,
        dislikesCount: 0,
        myStatus: ReactionStatus.None,
        newestLikes: [],
      },
      createdAt: expect.stringMatching(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      ),
    });

    // 🔻 Получаем пост и сравниваем с телом ответа
    const post: PostViewDto = await postsTestManager.getPostById(
      resCreatePosts.body.id,
    );
    expect(resCreatePosts.body).toEqual(post);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resCreatePosts.body,
        resCreatePosts.statusCode,
        'Test №1: BlogsAdminController - createPost() (POST: /sa/blogs/{blogId}/posts)',
      );
    }
  });

  it('should not create a post if the admin is not authenticated.', async () => {
    // 🔻 Создаем один блог, чтобы попытаться привязать к нему пост
    const [createdBlog]: BlogViewDto[] = await blogsTestManager.createBlog(1);

    // 🔻 Генерируем DTO для создания поста
    const [dto]: PostInputDto[] = TestDtoFactory.generatePostInputDto(1);

    // 🔻 Отправляем POST-запрос на создание поста без валидной авторизации
    const resCreatePosts: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/sa/blogs/${createdBlog.id}/posts`)
      .send(dto)
      .set('Authorization', 'incorrect login admin credentials')
      .expect(HttpStatus.UNAUTHORIZED);

    // 🔸 Убеждаемся, что пост не был создан — проверяем, что список постов пуст
    const posts: PaginatedViewDto<PostViewDto> =
      await postsTestManager.getAllPosts();

    expect(posts.items).toHaveLength(0);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resCreatePosts.body,
        resCreatePosts.statusCode,
        'Test №2: BlogsAdminController - createPost() (POST: /sa/blogs/{blogId}/posts)',
      );
    }
  });

  it('should not create a post if the data in the request body is incorrect (an empty object is passed).', async () => {
    // 🔻 Создаем блог, к которому будем пытаться привязать пост
    const [blog]: BlogViewDto[] = await blogsTestManager.createBlog(1);

    // 🔻 Отправляем POST-запрос с пустым телом запроса ({}), но с валидной авторизацией
    const resCreatePosts: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/sa/blogs/${blog.id}/posts`)
      .send({})
      .set('Authorization', adminCredentialsInBase64)
      .expect(HttpStatus.BAD_REQUEST); // 🔸 Ожидаем статус 400, так как тело запроса невалидно

    // 🔸 Проверяем, что в ответе указаны ошибки валидации для всех обязательных полей
    expect(resCreatePosts.body).toEqual({
      errorsMessages: [
        {
          field: 'content',
          message: 'content must be a string; Received value: undefined',
        },
        {
          field: 'shortDescription',
          message:
            'shortDescription must be a string; Received value: undefined',
        },
        {
          field: 'title',
          message: 'title must be a string; Received value: undefined',
        },
      ],
    });

    // 🔸 Убеждаемся, что пост не был создан — список постов должен быть пуст
    const posts: PaginatedViewDto<PostViewDto> =
      await postsTestManager.getAllPosts();

    expect(posts.items).toHaveLength(0);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resCreatePosts.body,
        resCreatePosts.statusCode,
        'Test №3: BlogsAdminController - createPost() (POST: /sa/blogs/{blogId}/posts)',
      );
    }
  });

  it('should not create a post if the data in the request body is incorrect (title: empty line, shortDescription: empty line, content: empty line).', async () => {
    // 🔻 Создаем блог, к которому будет пытаться добавляться пост
    const [blog]: BlogViewDto[] = await blogsTestManager.createBlog(1);

    // 🔻 Отправляем POST-запрос с пустыми строками (пробелами) в теле запроса
    const resCreatePosts: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/sa/blogs/${blog.id}/posts`)
      .send({
        title: '   ',
        shortDescription: '   ',
        content: '   ',
      })
      .set('Authorization', adminCredentialsInBase64) // 🔸 Админ авторизован корректно
      .expect(HttpStatus.BAD_REQUEST); // 🔸 Ожидаем ошибку 400, так как поля невалидны

    // 🔸 Проверяем, что в теле ответа возвращены ошибки валидации по всем трем полям
    expect(resCreatePosts.body).toEqual({
      errorsMessages: [
        {
          field: 'content',
          message:
            'content must be longer than or equal to 1 characters; Received value: ',
        },
        {
          field: 'shortDescription',
          message:
            'shortDescription must be longer than or equal to 1 characters; Received value: ',
        },
        {
          field: 'title',
          message:
            'title must be longer than or equal to 1 characters; Received value: ',
        },
      ],
    });

    // 🔸 Убеждаемся, что пост не был создан — список постов должен быть пустым
    const posts: PaginatedViewDto<PostViewDto> =
      await postsTestManager.getAllPosts();

    expect(posts.items).toHaveLength(0);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resCreatePosts.body,
        resCreatePosts.statusCode,
        'Test №4: BlogsAdminController - createPost() (POST: /sa/blogs/{blogId}/posts)',
      );
    }
  });

  it('should not create a post if the data in the request body is incorrect (title: exceeds max length, shortDescription: exceeds max length, content: exceeds max length).', async () => {
    // 🔻 Создаем блог, в который будет пытаться добавиться невалидный пост
    const [blog]: BlogViewDto[] = await blogsTestManager.createBlog(1);

    // 🔻 Подготавливаем данные, превышающие допустимые лимиты:
    // title: > 30 символов, shortDescription: > 100 символов, content: > 1000 символов
    const title: string = TestUtils.generateRandomString(31);
    const shortDescription: string = TestUtils.generateRandomString(101);
    const content: string = TestUtils.generateRandomString(1001);

    // 🔻 Выполняем POST-запрос на создание поста с невалидными данными
    const resCreatePosts: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/sa/blogs/${blog.id}/posts`)
      .send({
        title,
        shortDescription,
        content,
      })
      .set('Authorization', adminCredentialsInBase64) // 🔸 Админ авторизован
      .expect(HttpStatus.BAD_REQUEST); // 🔸 Ожидаем ошибку 400 — данные не прошли валидацию

    // 🔸 Проверяем, что API вернул три ошибки валидации по всем полям
    expect(resCreatePosts.body).toEqual({
      errorsMessages: [
        {
          field: 'content',
          message: `content must be shorter than or equal to 1000 characters; Received value: ${content}`,
        },
        {
          field: 'shortDescription',
          message: `shortDescription must be shorter than or equal to 100 characters; Received value: ${shortDescription}`,
        },
        {
          field: 'title',
          message: `title must be shorter than or equal to 30 characters; Received value: ${title}`,
        },
      ],
    });

    // 🔸 Убеждаемся, что пост не был создан — список постов должен быть пустым
    const posts: PaginatedViewDto<PostViewDto> =
      await postsTestManager.getAllPosts();

    expect(posts.items).toHaveLength(0);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resCreatePosts.body,
        resCreatePosts.statusCode,
        'Test №5: BlogsAdminController - createPost() (POST: /sa/blogs/{blogId}/posts)',
      );
    }
  });

  it('should not create a post if the data in the request body is incorrect (title: type number, shortDescription: type number, content: type number).', async () => {
    // 🔻 Создаем тестовый блог, к которому попытаемся привязать невалидный пост
    const [blog]: BlogViewDto[] = await blogsTestManager.createBlog(1);

    // 🔻 Пытаемся создать пост, где все поля переданы как числа (number), а не строки
    const resCreatePosts: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/sa/blogs/${blog.id}/posts`)
      .send({
        title: 123,
        shortDescription: 123,
        content: 123,
      })
      .set('Authorization', adminCredentialsInBase64) // 🔸 Админ авторизован
      .expect(HttpStatus.BAD_REQUEST); // 🔸 Ожидаем ошибку 400 — типы данных невалидны

    // 🔸 Проверяем, что API вернул корректные ошибки валидации по каждому полю
    expect(resCreatePosts.body).toEqual({
      errorsMessages: [
        {
          field: 'content',
          message: `content must be a string; Received value: 123`,
        },
        {
          field: 'shortDescription',
          message: `shortDescription must be a string; Received value: 123`,
        },
        {
          field: 'title',
          message: `title must be a string; Received value: 123`,
        },
      ],
    });

    // 🔸 Убеждаемся, что пост не был создан — база должна быть пустой
    const posts: PaginatedViewDto<PostViewDto> =
      await postsTestManager.getAllPosts();

    expect(posts.items).toHaveLength(0);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resCreatePosts.body,
        resCreatePosts.statusCode,
        'Test №6: BlogsAdminController - createPost() (POST: /sa/blogs/{blogId}/posts)',
      );
    }
  });

  it('should return a 404 error if the blog for which the post is being created does not exist.', async () => {
    await blogsTestManager.createBlog(1);

    const [dto]: PostInputDto[] = TestDtoFactory.generatePostInputDto(1);

    const incorrectBlogId: string = '1000000';

    const resCreatePosts: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/sa/blogs/${incorrectBlogId}/posts`)
      .send({
        title: dto.title,
        shortDescription: dto.shortDescription,
        content: dto.content,
      })
      .set('Authorization', adminCredentialsInBase64)
      .expect(HttpStatus.NOT_FOUND);

    const posts: PaginatedViewDto<PostViewDto> =
      await postsTestManager.getAllPosts();

    expect(posts.items).toHaveLength(0);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resCreatePosts.body,
        resCreatePosts.statusCode,
        'Test №7: BlogsAdminController - createPost() (POST: /sa/blogs/{blogId}/posts)',
      );
    }
  });
});
