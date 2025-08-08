import request, { Response } from 'supertest';
import { TestUtils } from '../../helpers/test.utils';
import { GLOBAL_PREFIX } from '../../../src/setup/global-prefix.setup';
import { TestLoggers } from '../../helpers/test.loggers';
import { AppTestManager } from '../../managers/app.test-manager';
import { AdminCredentials } from '../../types';
import { Server } from 'http';
import { BlogViewDto } from 'src/modules/bloggers-platform/blogs/api/view-dto/blog-view.dto';
import { BlogsTestManager } from '../../managers/blogs.test-manager';
import { HttpStatus } from '@nestjs/common';
import { PostViewDto } from '../../../src/modules/bloggers-platform/posts/api/view-dto/post-view.dto';
import { PostsTestManager } from '../../managers/posts.test-manager';
import { PostInputDto } from '../../../src/modules/bloggers-platform/posts/api/input-dto/post-input.dto';
import { ReactionStatus } from '../../../src/modules/bloggers-platform/reactions/types/reaction-db.type';

describe('BlogsAdminController - updatePost() (PUT: /sa/blogs/:blogId/posts/:postId)', () => {
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

  it('should update post, the admin is authenticated.', async () => {
    // 🔻 Создаем блог
    const [createdBlog]: BlogViewDto[] = await blogsTestManager.createBlog(1);

    // 🔻 Создаем пост, привязанный к этому блогу
    const [createdPost]: PostViewDto[] = await postsTestManager.createPost(
      1,
      createdBlog.id,
    );

    // 🔻 Формируем DTO с обновленными данными
    const dto: PostInputDto = {
      title: 'updateTitle',
      shortDescription: 'update short description',
      content: 'update content',
    };

    // 🔻 Отправляем PUT-запрос на обновление поста
    const resUpdatePost: Response = await request(server)
      .put(
        `/${GLOBAL_PREFIX}/sa/blogs/${createdBlog.id}/posts/${createdPost.id}`,
      )
      .send(dto)
      .set('Authorization', adminCredentialsInBase64)
      .expect(HttpStatus.NO_CONTENT);

    // 🔻 Получаем обновленный пост из базы данных
    const updatedPost: PostViewDto = await postsTestManager.getPostById(
      createdPost.id,
    );

    // 🔻 Убеждаемся, что обновленный пост отличается от оригинального
    expect(createdPost).not.toEqual(updatedPost);

    // 🔻 Проверяем, что обновленные поля соответствуют DTO
    expect(updatedPost).toEqual({
      id: expect.any(String),
      title: dto.title,
      shortDescription: dto.shortDescription,
      content: dto.content,
      blogId: createdBlog.id,
      blogName: createdBlog.name,
      extendedLikesInfo: {
        dislikesCount: 0,
        likesCount: 0,
        myStatus: ReactionStatus.None,
        newestLikes: [],
      },
      createdAt: expect.any(String),
    });

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resUpdatePost.body,
        resUpdatePost.statusCode,
        'Test №1: BlogsAdminController - updatePost() (PUT: /sa/blogs/:blogId/posts/:postId)',
      );
    }
  });

  it('should not update the post if the admin has not been authenticated.', async () => {
    // 🔻 Создаем блог
    const [createdBlog]: BlogViewDto[] = await blogsTestManager.createBlog(1);

    // 🔻 Создаем пост, привязанный к этому блогу
    const [createdPost]: PostViewDto[] = await postsTestManager.createPost(
      1,
      createdBlog.id,
    );

    // 🔻 Формируем DTO с новыми данными
    const dto: PostInputDto = {
      title: 'updateTitle',
      shortDescription: 'update short description',
      content: 'update content',
    };

    // 🔻 Отправляем PUT-запрос с некорректными данными авторизации
    const resUpdatePost: Response = await request(server)
      .put(
        `/${GLOBAL_PREFIX}/sa/blogs/${createdBlog.id}/posts/${createdPost.id}`,
      )
      .send(dto)
      .set('Authorization', 'incorrect admin credentials')
      .expect(HttpStatus.UNAUTHORIZED);

    // 🔻 Получаем пост из базы данных, чтобы убедиться, что он не был изменен
    const post: PostViewDto = await postsTestManager.getPostById(
      createdPost.id,
    );

    // 🔻 Проверяем, что пост остался без изменений
    expect(createdPost).toEqual(post);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resUpdatePost.body,
        resUpdatePost.statusCode,
        'Test №2: BlogsAdminController - updatePost() (PUT: /sa/blogs/:blogId/posts/:postId)',
      );
    }
  });

  it('should not update a post if the data in the request body is incorrect (an empty object is passed).', async () => {
    // 🔻 Создаем блог
    const [createdBlog]: BlogViewDto[] = await blogsTestManager.createBlog(1);

    // 🔻 Создаем пост, привязанный к этому блогу
    const [createdPost]: PostViewDto[] = await postsTestManager.createPost(
      1,
      createdBlog.id,
    );

    // 🔻 Отправляем PUT-запрос с пустым телом ({}), что является невалидным
    const resUpdatePost: Response = await request(server)
      .put(
        `/${GLOBAL_PREFIX}/sa/blogs/${createdBlog.id}/posts/${createdPost.id}`,
      )
      .send({})
      .set('Authorization', adminCredentialsInBase64)
      .expect(HttpStatus.BAD_REQUEST);

    // 🔻 Проверяем тело ответа на наличие ошибок валидации
    expect(resUpdatePost.body).toEqual({
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

    // 🔻 Получаем пост из базы данных, чтобы убедиться, что он не был изменен
    const post: PostViewDto = await postsTestManager.getPostById(
      createdPost.id,
    );

    // 🔻 Сравниваем — пост должен остаться прежним
    expect(createdPost).toEqual(post);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resUpdatePost.body,
        resUpdatePost.statusCode,
        'Test №3: BlogsAdminController - updatePost() (PUT: /sa/blogs/:blogId/posts/:postId)',
      );
    }
  });

  it('should not update a blog if the data in the request body is incorrect (title: empty line, shortDescription: empty line, content: empty line, blogId: empty line).', async () => {
    // 🔻 Создаем блог
    const [createdBlog]: BlogViewDto[] = await blogsTestManager.createBlog(1);

    // 🔻 Создаем пост, привязанный к этому блогу
    const [createdPost]: PostViewDto[] = await postsTestManager.createPost(
      1,
      createdBlog.id,
    );

    // 🔻 Отправляем PUT-запрос с полями, содержащими только пробелы
    const resUpdatePost: Response = await request(server)
      .put(
        `/${GLOBAL_PREFIX}/sa/blogs/${createdBlog.id}/posts/${createdPost.id}`,
      )
      .send({
        title: '   ',
        shortDescription: '   ',
        content: '   ',
      })
      .set('Authorization', adminCredentialsInBase64)
      .expect(HttpStatus.BAD_REQUEST);

    // 🔻 Проверяем, что ответ содержит ошибки валидации по title, shortDescription и content
    expect(resUpdatePost.body).toEqual({
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

    // 🔻 Получаем пост из базы данных, чтобы убедиться, что он остался неизменным
    const post: PostViewDto = await postsTestManager.getPostById(
      createdPost.id,
    );

    // 🔻 Сравниваем — пост не должен измениться
    expect(createdPost).toEqual(post);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resUpdatePost.body,
        resUpdatePost.statusCode,
        'Test №4: BlogsAdminController - updatePost() (PUT: /sa/blogs/:blogId/posts/:postId)',
      );
    }
  });

  it('should not update a blog if the data in the request body is incorrect (title: exceeds max length, shortDescription: exceeds max length, content: exceeds max length, blogId: incorrect).', async () => {
    // 🔻 Создаем блог
    const [createdBlog]: BlogViewDto[] = await blogsTestManager.createBlog(1);

    // 🔻 Создаем пост, привязанный к этому блогу
    const [createdPost]: PostViewDto[] = await postsTestManager.createPost(
      1,
      createdBlog.id,
    );

    // 🔻 Генерируем строки, превышающие допустимую длину
    const title: string = TestUtils.generateRandomString(31);
    const shortDescription: string = TestUtils.generateRandomString(101);
    const content: string = TestUtils.generateRandomString(1001);

    // 🔻 Отправляем PUT-запрос на обновление поста с некорректными данными
    const resUpdatePost: Response = await request(server)
      .put(
        `/${GLOBAL_PREFIX}/sa/blogs/${createdBlog.id}/posts/${createdPost.id}`,
      )
      .send({
        title,
        shortDescription,
        content,
      })
      .set('Authorization', adminCredentialsInBase64)
      .expect(HttpStatus.BAD_REQUEST);

    // 🔻 Проверяем, что ответ содержит ошибки валидации
    expect(resUpdatePost.body).toEqual({
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

    // 🔻 Получаем пост из базы данных, чтобы убедиться, что он не изменился
    const post: PostViewDto = await postsTestManager.getPostById(
      createdPost.id,
    );

    // 🔻 Проверяем, что пост остался неизменным
    expect(createdPost).toEqual(post);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resUpdatePost.body,
        resUpdatePost.statusCode,
        'Test №5: BlogsAdminController - updatePost() (PUT: /sa/blogs/:blogId/posts/:postId)',
      );
    }
  });

  it('should not update a blog if the data in the request body is incorrect (title: type number, shortDescription: type number, content: type number, blogId: incorrect).', async () => {
    // 🔻 Создаем блог
    const [createdBlog]: BlogViewDto[] = await blogsTestManager.createBlog(1);

    // 🔻 Создаем пост, связанный с этим блогом
    const [createdPost]: PostViewDto[] = await postsTestManager.createPost(
      1,
      createdBlog.id,
    );

    // 🔻 Отправляем PUT-запрос с полями неправильного типа (number вместо string)
    const resUpdatePost: Response = await request(server)
      .put(
        `/${GLOBAL_PREFIX}/sa/blogs/${createdBlog.id}/posts/${createdPost.id}`,
      )
      .send({
        title: 123,
        shortDescription: 123,
        content: 123,
      })
      .set('Authorization', adminCredentialsInBase64)
      .expect(HttpStatus.BAD_REQUEST);

    // 🔻 Проверяем, что ответ содержит ошибки валидации по типу
    expect(resUpdatePost.body).toEqual({
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

    // 🔻 Получаем пост из базы, чтобы убедиться, что он не был изменён
    const post: PostViewDto = await postsTestManager.getPostById(
      createdPost.id,
    );

    // 🔻 Сравниваем, что пост остался прежним
    expect(createdPost).toEqual(post);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resUpdatePost.body,
        resUpdatePost.statusCode,
        'Test №6: BlogsAdminController - updatePost() (PUT: /sa/blogs/:blogId/posts/:postId)',
      );
    }
  });

  it('should return a 404 error if the post does not exist.', async () => {
    // 🔻 Создаем блог
    const [createdBlog]: BlogViewDto[] = await blogsTestManager.createBlog(1);

    // 🔻 Создаем пост, привязанный к этому блогу
    const [createdPost]: PostViewDto[] = await postsTestManager.createPost(
      1,
      createdBlog.id,
    );

    // 🔻 DTO с валидными данными для обновления
    const dto: PostInputDto = {
      title: 'updateTitle',
      shortDescription: 'update short description',
      content: 'update content',
    };

    // 🔻 Используем несуществующий ID поста
    const incorrectPostId: string = '1000000';

    // 🔻 Отправляем PUT-запрос на обновление несуществующего поста
    const resUpdatePost: Response = await request(server)
      .put(
        `/${GLOBAL_PREFIX}/sa/blogs/${createdBlog.id}/posts/${incorrectPostId}`,
      )
      .send(dto)
      .set('Authorization', adminCredentialsInBase64)
      .expect(HttpStatus.NOT_FOUND);

    // 🔻 Получаем оригинальный пост из базы, чтобы убедиться, что он не изменился
    const post: PostViewDto = await postsTestManager.getPostById(
      createdPost.id,
    );

    // 🔻 Проверяем, что содержимое поста осталось прежним
    expect(createdPost).toEqual(post);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resUpdatePost.body,
        resUpdatePost.statusCode,
        'Test №7: BlogsAdminController - updatePost() (PUT: /sa/blogs/:blogId/posts/:postId)',
      );
    }
  });
  //TODO: дописать тесты: 1. если блог по id не найден, 2. если пост не пренадлежит найденному блогу по id
});
