import request, { Response } from 'supertest';
import { TestUtils } from '../helpers/test.utils';
import { TestDtoFactory } from '../helpers/test.dto-factory';
import { GLOBAL_PREFIX } from '../../src/setup/global-prefix.setup';
import { TestLoggers } from '../helpers/test.loggers';
import { AppTestManager } from '../managers/app.test-manager';
import { AdminCredentials, TestResultLogin } from '../types';
import { Server } from 'http';
import { BlogsTestManager } from '../managers/blogs.test-manager';
import { HttpStatus } from '@nestjs/common';
import { PostViewDto } from '../../src/modules/bloggers-platform/posts/api/view-dto/post.view-dto';
import { PostsTestManager } from '../managers/posts.test-manager';
import { UsersTestManager } from '../managers/users.test-manager';
import { CommentInputDto } from '../../src/modules/bloggers-platform/comments/api/input-dto/comment-input.dto';
import { CommentViewDto } from '../../src/modules/bloggers-platform/comments/api/view-dto/comment-view.dto';
import { UserAccountsConfig } from '../../src/modules/user-accounts/config/user-accounts.config';
import { JwtService } from '@nestjs/jwt';
import { CommentsTestManager } from '../managers/comments.test-manager';
import { ACCESS_TOKEN_STRATEGY_INJECT_TOKEN } from '../../src/modules/user-accounts/auth/constants/auth-tokens.inject-constants';
import { UserViewDto } from '../../src/modules/user-accounts/users/api/view-dto/user.view-dto';
import { PaginatedViewDto } from '../../src/core/dto/paginated.view-dto';
import { BlogViewDto } from '../../src/modules/bloggers-platform/blogs/api/view-dto/blog.view-dto';
import { ReactionStatus } from '../../src/modules/bloggers-platform/reactions/domain/entities/reaction.entity';

describe('PostsController - createComment() (POST: /posts/{postId}/comments)', () => {
  let appTestManager: AppTestManager;
  let blogsTestManager: BlogsTestManager;
  let postsTestManager: PostsTestManager;
  let usersTestManager: UsersTestManager;
  let commentsTestManager: CommentsTestManager;
  let adminCredentials: AdminCredentials;
  let adminCredentialsInBase64: string;
  let testLoggingEnabled: boolean;
  let server: Server;

  beforeAll(async () => {
    appTestManager = new AppTestManager();
    await appTestManager.init((moduleBuilder) =>
      moduleBuilder.overrideProvider(ACCESS_TOKEN_STRATEGY_INJECT_TOKEN).useFactory({
        factory: (userAccountsConfig: UserAccountsConfig) => {
          return new JwtService({
            secret: userAccountsConfig.accessTokenSecret,
            signOptions: { expiresIn: '2s' },
          });
        },
        inject: [UserAccountsConfig],
      }),
    );

    adminCredentials = appTestManager.getAdminCredentials();
    adminCredentialsInBase64 = TestUtils.encodingAdminDataInBase64(
      adminCredentials.login,
      adminCredentials.password,
    );
    server = appTestManager.getServer();
    testLoggingEnabled = appTestManager.coreConfig.testLoggingEnabled;

    blogsTestManager = new BlogsTestManager(server, adminCredentialsInBase64);
    postsTestManager = new PostsTestManager(server, adminCredentialsInBase64);
    usersTestManager = new UsersTestManager(server, adminCredentialsInBase64);
    commentsTestManager = new CommentsTestManager(server);
  });

  beforeEach(async () => {
    await appTestManager.cleanupDb(['schema_migrations']);

    appTestManager.clearThrottlerStorage();
  });

  afterAll(async () => {
    await appTestManager.close();
  });

  it('should create a new comment if the user is logged in.', async () => {
    // 🔻 Создаём блог
    const [createdBlog]: BlogViewDto[] = await blogsTestManager.createBlog(1);

    // 🔻 Создаём пост в этом блоге
    const [createdPost]: PostViewDto[] = await postsTestManager.createPost(1, createdBlog.id);

    // 🔻 Создаём пользователя
    const [createdUser]: UserViewDto[] = await usersTestManager.createUser(1);

    // 🔻 Логинимся под этим пользователем и получаем токены авторизации
    const [resultLogin]: TestResultLogin[] = await usersTestManager.login([createdUser.login]);

    // 🔻 Генерируем DTO для комментария
    const [dto]: CommentInputDto[] = TestDtoFactory.generateCommentInputDto(1);

    // 🔻 Отправляем POST-запрос на создание комментария к посту с авторизацией
    const resCreateComment: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/posts/${createdPost.id}/comments`)
      .send(dto)
      .set('Authorization', `Bearer ${resultLogin.authTokens.accessToken}`)
      .expect(HttpStatus.CREATED);

    // 🔻 Проверяем, что тело ответа содержит корректные данные комментария
    expect(resCreateComment.body).toEqual({
      id: expect.any(String),
      content: dto.content,
      commentatorInfo: {
        userId: createdUser.id,
        userLogin: createdUser.login,
      },
      likesInfo: {
        likesCount: 0,
        dislikesCount: 0,
        myStatus: ReactionStatus.None,
      },
      createdAt: expect.stringMatching(
        /\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z)/,
      ),
    });

    // 🔻 Получаем созданный комментарий из базы по его id
    const newlyCreatedComment: CommentViewDto = await commentsTestManager.getById(
      resCreateComment.body.id,
    );

    // 🔻 Сверяем, что данные в ответе API и в базе совпадают
    expect(resCreateComment.body).toEqual(newlyCreatedComment);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resCreateComment.body,
        resCreateComment.statusCode,
        'Test №1: PostsController - createComment() (POST: /posts/{postId}/comments)',
      );
    }
  });

  it('should return a 401 error if the user is not logged in (sending an invalid access token)', async () => {
    // 🔻 Создаём блог
    const [createdBlog]: BlogViewDto[] = await blogsTestManager.createBlog(1);
    // 🔻 Создаём пост в этом блоге
    const [createdPost]: PostViewDto[] = await postsTestManager.createPost(1, createdBlog.id);
    // 🔻 Создаём пользователя
    const [createdUser]: UserViewDto[] = await usersTestManager.createUser(1);
    // 🔻 Логинимся под этим пользователем и получаем токены авторизации
    const [resultLogin]: TestResultLogin[] = await usersTestManager.login([createdUser.login]);
    // 🔻 Генерируем DTO для комментария
    const [dto]: CommentInputDto[] = TestDtoFactory.generateCommentInputDto(1);

    // 🔻 Делаем паузу 3 секунды (имитация устаревания или недействительности токена)
    await TestUtils.delay(3000);

    // 🔻 Отправляем POST-запрос на создание комментария с невалидным токеном и ожидаем 401
    const resCreateComment: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/posts/${createdPost.id}/comments`)
      .send(dto)
      .set('Authorization', `Bearer ${resultLogin.authTokens.accessToken}`)
      .expect(HttpStatus.UNAUTHORIZED);

    // 🔻 Получаем список комментариев к посту
    const comments: PaginatedViewDto<CommentViewDto> = await commentsTestManager.getAll(
      createdPost.id,
    );

    // 🔻 Проверяем, что комментарии отсутствуют (длина массива 0)
    expect(comments.items.length).toEqual(0);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resCreateComment.body,
        resCreateComment.statusCode,
        'Test №2: PostsController - createComment() (POST: /posts/{postId}/comments)',
      );
    }
  });

  it("should not create a new comment If post with specified postId doesn't exists.", async () => {
    // 🔻 Создаём блог
    const [createdBlog]: BlogViewDto[] = await blogsTestManager.createBlog(1);
    // 🔻 Создаём пост в этом блоге
    const [createdPost]: PostViewDto[] = await postsTestManager.createPost(1, createdBlog.id);
    // 🔻 Создаём пользователя
    const [createdUser]: UserViewDto[] = await usersTestManager.createUser(1);
    // 🔻 Логинимся под этим пользователем и получаем токены авторизации
    const [resultLogin]: TestResultLogin[] = await usersTestManager.login([createdUser.login]);
    // 🔻 Генерируем DTO для комментария
    const [dto]: CommentInputDto[] = TestDtoFactory.generateCommentInputDto(1);
    // 🔻 Определяем некорректный ID поста
    const incorrectPostId: string = '1000000';

    // 🔻 Отправляем POST-запрос на создание комментария с несуществующим postId и ожидаем 404
    const resCreateComment: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/posts/${incorrectPostId}/comments`)
      .send(dto)
      .set('Authorization', `Bearer ${resultLogin.authTokens.accessToken}`)
      .expect(HttpStatus.NOT_FOUND);

    // 🔻 Получаем список комментариев к существующему посту
    const comments: PaginatedViewDto<CommentViewDto> = await commentsTestManager.getAll(
      createdPost.id,
    );

    // 🔻 Проверяем, что комментарии отсутствуют (длина массива 0)
    expect(comments.items.length).toEqual(0);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resCreateComment.body,
        resCreateComment.statusCode,
        'Test №3: PostsController - createComment() (POST: /posts/{postId}/comments)',
      );
    }
  });

  it('should not create a commentary if the data in the request body is incorrect (an empty object is passed).', async () => {
    // 🔻 Создаём блог
    const [createdBlog]: BlogViewDto[] = await blogsTestManager.createBlog(1);
    // 🔻 Создаём пост в этом блоге
    const [createdPost]: PostViewDto[] = await postsTestManager.createPost(1, createdBlog.id);
    // 🔻 Создаём пользователя
    const [createdUser]: UserViewDto[] = await usersTestManager.createUser(1);
    // 🔻 Логинимся под этим пользователем и получаем токены авторизации
    const [resultLogin]: TestResultLogin[] = await usersTestManager.login([createdUser.login]);

    // 🔻 Отправляем POST-запрос на создание комментария с пустым объектом в теле запроса
    // 🔻 Ожидаем 400 Bad Request, потому что поле "content" не передано
    const resCreateComment: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/posts/${createdPost.id}/comments`)
      .send({})
      .set('Authorization', `Bearer ${resultLogin.authTokens.accessToken}`)
      .expect(HttpStatus.BAD_REQUEST);

    // 🔻 Проверяем, что ответ содержит сообщение об ошибке для поля "content"
    expect(resCreateComment.body).toEqual({
      errorsMessages: [
        {
          field: 'content',
          message: 'content must be a string; Received value: undefined',
        },
      ],
    });

    // 🔻 Получаем список комментариев к посту
    const comments: PaginatedViewDto<CommentViewDto> = await commentsTestManager.getAll(
      createdPost.id,
    );

    // 🔻 Проверяем, что комментарии отсутствуют (длина массива 0)
    expect(comments.items.length).toEqual(0);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resCreateComment.body,
        resCreateComment.statusCode,
        'Test №4: PostsController - createComment() (POST: /posts/{postId}/comments)',
      );
    }
  });

  it('should not create a commentary if the data in the request body is incorrect (the content field contains data of the number type).', async () => {
    // 🔻 Создаём блог
    const [createdBlog]: BlogViewDto[] = await blogsTestManager.createBlog(1);
    // 🔻 Создаём пост в этом блоге
    const [createdPost]: PostViewDto[] = await postsTestManager.createPost(1, createdBlog.id);
    // 🔻 Создаём пользователя
    const [createdUser]: UserViewDto[] = await usersTestManager.createUser(1);
    // 🔻 Логинимся под этим пользователем и получаем токены авторизации
    const [resultLogin]: TestResultLogin[] = await usersTestManager.login([createdUser.login]);

    // 🔻 Отправляем POST-запрос на создание комментария, где поле "content" передано как число (123)
    // 🔻 Ожидаем 400 Bad Request, потому что поле "content" должно быть строкой
    const resCreateComment: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/posts/${createdPost.id}/comments`)
      .send({ content: 123 })
      .set('Authorization', `Bearer ${resultLogin.authTokens.accessToken}`)
      .expect(HttpStatus.BAD_REQUEST);

    // 🔻 Проверяем, что ответ содержит сообщение об ошибке для поля "content"
    expect(resCreateComment.body).toEqual({
      errorsMessages: [
        {
          field: 'content',
          message: 'content must be a string; Received value: 123',
        },
      ],
    });

    // 🔻 Получаем список комментариев к посту
    const comments: PaginatedViewDto<CommentViewDto> = await commentsTestManager.getAll(
      createdPost.id,
    );

    // 🔻 Проверяем, что комментарии отсутствуют (длина массива 0)
    expect(comments.items.length).toEqual(0);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resCreateComment.body,
        resCreateComment.statusCode,
        'Test №5: PostsController - createComment() (POST: /posts/{postId}/comments)',
      );
    }
  });

  it('should not create a commentary if the data in the request body is incorrect (the content field is less than 20 characters long).', async () => {
    // 🔻 Создаём блог
    const [createdBlog]: BlogViewDto[] = await blogsTestManager.createBlog(1);
    // 🔻 Создаём пост в этом блоге
    const [createdPost]: PostViewDto[] = await postsTestManager.createPost(1, createdBlog.id);
    // 🔻 Создаём пользователя
    const [createdUser]: UserViewDto[] = await usersTestManager.createUser(1);
    // 🔻 Логинимся под этим пользователем и получаем токены авторизации
    const [resultLogin]: TestResultLogin[] = await usersTestManager.login([createdUser.login]);
    // 🔻 Генерируем строку длиной 19 символов (меньше минимально допустимых 20)
    const content: string = TestUtils.generateRandomString(19);

    // 🔻 Отправляем POST-запрос на создание комментария с полем "content" короче 20 символов
    // 🔻 Ожидаем 400 Bad Request, потому что длина поля "content" меньше минимально допустимой
    const resCreateComment: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/posts/${createdPost.id}/comments`)
      .send({ content })
      .set('Authorization', `Bearer ${resultLogin.authTokens.accessToken}`)
      .expect(HttpStatus.BAD_REQUEST);

    // 🔻 Проверяем, что ответ содержит сообщение об ошибке для поля "content"
    expect(resCreateComment.body).toEqual({
      errorsMessages: [
        {
          field: 'content',
          message: `content must be longer than or equal to 20 characters; Received value: ${content}`,
        },
      ],
    });

    // 🔻 Получаем список комментариев к посту
    const comments: PaginatedViewDto<CommentViewDto> = await commentsTestManager.getAll(
      createdPost.id,
    );

    // 🔻 Проверяем, что комментарии отсутствуют (длина массива 0)
    expect(comments.items.length).toEqual(0);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resCreateComment.body,
        resCreateComment.statusCode,
        'Test №6: PostsController - createComment() (POST: /posts/{postId}/comments)',
      );
    }
  });

  it('should not create a commentary if the data in the request body is incorrect (the content field is more than 300 characters long).', async () => {
    // 🔻 Создаём блог
    const [createdBlog]: BlogViewDto[] = await blogsTestManager.createBlog(1);
    // 🔻 Создаём пост в этом блоге
    const [createdPost]: PostViewDto[] = await postsTestManager.createPost(1, createdBlog.id);
    // 🔻 Создаём пользователя
    const [createdUser]: UserViewDto[] = await usersTestManager.createUser(1);
    // 🔻 Логинимся под этим пользователем и получаем токены авторизации
    const [resultLogin]: TestResultLogin[] = await usersTestManager.login([createdUser.login]);
    // 🔻 Генерируем строку длиной 301 символ (превышает максимально допустимые 300)
    const content: string = TestUtils.generateRandomString(301);

    // 🔻 Отправляем POST-запрос на создание комментария с полем "content" длиннее 300 символов
    // 🔻 Ожидаем 400 Bad Request, потому что длина поля "content" превышает максимально допустимую
    const resCreateComment: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/posts/${createdPost.id}/comments`)
      .send({ content })
      .set('Authorization', `Bearer ${resultLogin.authTokens.accessToken}`)
      .expect(HttpStatus.BAD_REQUEST);

    // 🔻 Проверяем, что ответ содержит сообщение об ошибке для поля "content"
    expect(resCreateComment.body).toEqual({
      errorsMessages: [
        {
          field: 'content',
          message: `content must be shorter than or equal to 300 characters; Received value: ${content}`,
        },
      ],
    });

    // 🔻 Получаем список комментариев к посту
    const comments: PaginatedViewDto<CommentViewDto> = await commentsTestManager.getAll(
      createdPost.id,
    );

    // 🔻 Проверяем, что комментарии отсутствуют (длина массива 0)
    expect(comments.items.length).toEqual(0);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resCreateComment.body,
        resCreateComment.statusCode,
        'Test №7: PostsController - createComment() (POST: /posts/{postId}/comments)',
      );
    }
  });
});
