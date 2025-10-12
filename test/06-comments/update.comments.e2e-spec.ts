import request, { Response } from 'supertest';
import { TestUtils } from '../helpers/test.utils';
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
import { CommentViewDto } from '../../src/modules/bloggers-platform/comments/api/view-dto/comment-view.dto';
import { CommentsTestManager } from '../managers/comments.test-manager';
import { UserAccountsConfig } from '../../src/modules/user-accounts/config/user-accounts.config';
import { JwtService } from '@nestjs/jwt';
import { ACCESS_TOKEN_STRATEGY_INJECT_TOKEN } from '../../src/modules/user-accounts/auth/constants/auth-tokens.inject-constants';
import { UserViewDto } from '../../src/modules/user-accounts/users/api/view-dto/user.view-dto';
import { BlogViewDto } from '../../src/modules/bloggers-platform/blogs/api/view-dto/blog.view-dto';
import { ReactionStatus } from '../../src/modules/bloggers-platform/reactions/domain/entities/reaction.entity';

describe('CommentsController - updateComment() (PUT: /comments/:id)', () => {
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
    await appTestManager.cleanupDb(['migrations']);

    appTestManager.clearThrottlerStorage();
  });

  afterAll(async () => {
    await appTestManager.close();
  });

  it('should update the comment if the user is logged in.', async () => {
    // 🔻 Создаём блог
    const [createdBlog]: BlogViewDto[] = await blogsTestManager.createBlog(1);
    // 🔻 Создаём пост в этом блоге
    const [createdPost]: PostViewDto[] = await postsTestManager.createPost(1, createdBlog.id);
    // 🔻 Создаём пользователя
    const [createdUser]: UserViewDto[] = await usersTestManager.createUser(1);
    // 🔻 Логинимся под этим пользователем и получаем токены авторизации
    const [resultLogin]: TestResultLogin[] = await usersTestManager.login([createdUser.login]);
    // 🔻 Создаём комментарий к посту от имени авторизованного пользователя
    const [createdComment]: CommentViewDto[] = await commentsTestManager.createComment(
      1,
      createdPost.id,
      resultLogin.authTokens.accessToken,
    );

    // 🔻 Определяем новый контент для комментария
    const newContent: string = 'update content comment';

    // 🔻 Отправляем PUT-запрос на обновление комментария с новым контентом
    // 🔻 Ожидаем 204 No Content, так как пользователь авторизован
    const resUpdateComment: Response = await request(server)
      .put(`/${GLOBAL_PREFIX}/comments/${createdComment.id}`)
      .set('Authorization', `Bearer ${resultLogin.authTokens.accessToken}`)
      .send({ content: newContent })
      .expect(HttpStatus.NO_CONTENT);

    // 🔻 Получаем обновлённый комментарий по ID
    const updatedComment: CommentViewDto = await commentsTestManager.getById(createdComment.id);

    // 🔻 Проверяем, что данные комментария соответствуют обновлённому контенту
    expect(updatedComment).toEqual({
      id: createdComment.id,
      content: newContent,
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

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resUpdateComment.body,
        resUpdateComment.statusCode,
        'Test №1: CommentsController - updateComment() (PUT: /comments/:id)',
      );
    }
  });

  it('should not update the comment if the user is not logged in.', async () => {
    // 🔻 Создаём блог
    const [createdBlog]: BlogViewDto[] = await blogsTestManager.createBlog(1);
    // 🔻 Создаём пост в этом блоге
    const [createdPost]: PostViewDto[] = await postsTestManager.createPost(1, createdBlog.id);
    // 🔻 Создаём пользователя
    const [createdUser]: UserViewDto[] = await usersTestManager.createUser(1);
    // 🔻 Логинимся под этим пользователем и получаем токены авторизации
    const [resultLogin]: TestResultLogin[] = await usersTestManager.login([createdUser.login]);
    // 🔻 Создаём комментарий к посту от имени авторизованного пользователя
    const [createdComment]: CommentViewDto[] = await commentsTestManager.createComment(
      1,
      createdPost.id,
      resultLogin.authTokens.accessToken,
    );

    // 🔻 Определяем новый контент для комментария
    const newContent: string = 'update content comment';

    // 🔻 Имитируем задержку 3 секунды (токен становится недействительным/просроченным)
    await TestUtils.delay(3000);

    // 🔻 Отправляем PUT-запрос на обновление комментария с новым контентом
    // 🔻 Ожидаем 401 Unauthorized, потому что пользователь не авторизован
    const resUpdateComment: Response = await request(server)
      .put(`/${GLOBAL_PREFIX}/comments/${createdComment.id}`)
      .set('Authorization', `Bearer ${resultLogin.authTokens.accessToken}`)
      .send({ content: newContent })
      .expect(HttpStatus.UNAUTHORIZED);

    // 🔻 Получаем комментарий заново
    const newlyCreatedComment: CommentViewDto = await commentsTestManager.getById(
      createdComment.id,
    );

    // 🔻 Проверяем, что комментарий не изменился
    expect(createdComment).toEqual(newlyCreatedComment);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resUpdateComment.body,
        resUpdateComment.statusCode,
        'Test №2: CommentsController - updateComment() (PUT: /comments/:id)',
      );
    }
  });

  it('should not update the comment if the data in the request body is incorrect (an empty object is passed).', async () => {
    // 🔻 Создаём блог
    const [createdBlog]: BlogViewDto[] = await blogsTestManager.createBlog(1);
    // 🔻 Создаём пост в этом блоге
    const [createdPost]: PostViewDto[] = await postsTestManager.createPost(1, createdBlog.id);
    // 🔻 Создаём пользователя
    const [createdUser]: UserViewDto[] = await usersTestManager.createUser(1);
    // 🔻 Логинимся под этим пользователем и получаем токены авторизации
    const [resultLogin]: TestResultLogin[] = await usersTestManager.login([createdUser.login]);
    // 🔻 Создаём комментарий к посту от имени авторизованного пользователя
    const [createdComment]: CommentViewDto[] = await commentsTestManager.createComment(
      1,
      createdPost.id,
      resultLogin.authTokens.accessToken,
    );

    // 🔻 Отправляем PUT-запрос на обновление комментария с пустым телом запроса
    // 🔻 Ожидаем 400 Bad Request, так как поле "content" отсутствует
    const resUpdateComment: Response = await request(server)
      .put(`/${GLOBAL_PREFIX}/comments/${createdComment.id}`)
      .set('Authorization', `Bearer ${resultLogin.authTokens.accessToken}`)
      .send({})
      .expect(HttpStatus.BAD_REQUEST);

    // 🔻 Проверяем, что тело ответа содержит ошибку валидации для поля "content"
    expect(resUpdateComment.body).toEqual({
      errorsMessages: [
        {
          field: 'content',
          message: 'content must be a string; Received value: undefined',
        },
      ],
    });

    // 🔻 Получаем комментарий заново
    const newlyCreatedComment: CommentViewDto = await commentsTestManager.getById(
      createdComment.id,
    );

    // 🔻 Проверяем, что комментарий не изменился
    expect(createdComment).toEqual(newlyCreatedComment);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resUpdateComment.body,
        resUpdateComment.statusCode,
        'Test №3: CommentsController - updateComment() (PUT: /comments/:id)',
      );
    }
  });

  it('should not update the comment if the data in the request body is incorrect (the content field contains data of the number type).', async () => {
    // 🔻 Создаём блог
    const [createdBlog]: BlogViewDto[] = await blogsTestManager.createBlog(1);
    // 🔻 Создаём пост в этом блоге
    const [createdPost]: PostViewDto[] = await postsTestManager.createPost(1, createdBlog.id);
    // 🔻 Создаём пользователя
    const [createdUser]: UserViewDto[] = await usersTestManager.createUser(1);
    // 🔻 Логинимся под этим пользователем и получаем токены авторизации
    const [resultLogin]: TestResultLogin[] = await usersTestManager.login([createdUser.login]);
    // 🔻 Создаём комментарий к посту от имени авторизованного пользователя
    const [createdComment]: CommentViewDto[] = await commentsTestManager.createComment(
      1,
      createdPost.id,
      resultLogin.authTokens.accessToken,
    );

    // 🔻 Определяем некорректное значение для поля "content" (по длине меньше 20 символов)
    const content: string = '123';

    // 🔻 Отправляем PUT-запрос на обновление комментария с некорректным содержимым
    // 🔻 Ожидаем 400 Bad Request, так как длина "content" меньше минимально допустимой
    const resUpdateComment: Response = await request(server)
      .put(`/${GLOBAL_PREFIX}/comments/${createdComment.id}`)
      .set('Authorization', `Bearer ${resultLogin.authTokens.accessToken}`)
      .send({ content })
      .expect(HttpStatus.BAD_REQUEST);

    // 🔻 Проверяем, что тело ответа содержит корректное сообщение об ошибке для поля "content"
    expect(resUpdateComment.body).toEqual({
      errorsMessages: [
        {
          field: 'content',
          message: `content must be longer than or equal to 20 characters; Received value: ${content}`,
        },
      ],
    });

    // 🔻 Получаем комментарий после попытки обновления
    const newlyCreatedComment: CommentViewDto = await commentsTestManager.getById(
      createdComment.id,
    );

    // 🔻 Проверяем, что комментарий не изменился
    expect(createdComment).toEqual(newlyCreatedComment);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resUpdateComment.body,
        resUpdateComment.statusCode,
        'Test №4: CommentsController - updateComment() (PUT: /comments/:id)',
      );
    }
  });

  it('should not update the comment if the data in the request body is incorrect (the content field is less than 20 characters long).', async () => {
    // 🔻 Создаём блог
    const [createdBlog]: BlogViewDto[] = await blogsTestManager.createBlog(1);
    // 🔻 Создаём пост в этом блоге
    const [createdPost]: PostViewDto[] = await postsTestManager.createPost(1, createdBlog.id);
    // 🔻 Создаём пользователя
    const [createdUser]: UserViewDto[] = await usersTestManager.createUser(1);
    // 🔻 Логинимся под этим пользователем и получаем токены авторизации
    const [resultLogin]: TestResultLogin[] = await usersTestManager.login([createdUser.login]);
    // 🔻 Создаём комментарий к посту от имени авторизованного пользователя
    const [createdComment]: CommentViewDto[] = await commentsTestManager.createComment(
      1,
      createdPost.id,
      resultLogin.authTokens.accessToken,
    );

    // 🔻 Генерируем строку длиной 19 символов, что меньше минимального допустимого значения (20 символов)
    const content: string = TestUtils.generateRandomString(19);

    // 🔻 Отправляем PUT-запрос на обновление комментария с контентом некорректной длины
    // 🔻 Ожидаем 400 Bad Request, так как длина "content" меньше минимально допустимой
    const resUpdateComment: Response = await request(server)
      .put(`/${GLOBAL_PREFIX}/comments/${createdComment.id}`)
      .set('Authorization', `Bearer ${resultLogin.authTokens.accessToken}`)
      .send({ content })
      .expect(HttpStatus.BAD_REQUEST);

    // 🔻 Проверяем, что тело ответа содержит ошибку валидации для поля "content"
    expect(resUpdateComment.body).toEqual({
      errorsMessages: [
        {
          field: 'content',
          message: `content must be longer than or equal to 20 characters; Received value: ${content}`,
        },
      ],
    });

    // 🔻 Получаем комментарий после попытки обновления
    const newlyCreatedComment: CommentViewDto = await commentsTestManager.getById(
      createdComment.id,
    );

    // 🔻 Проверяем, что комментарий не изменился
    expect(createdComment).toEqual(newlyCreatedComment);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resUpdateComment.body,
        resUpdateComment.statusCode,
        'Test №5: CommentsController - updateComment() (PUT: /comments/:id)',
      );
    }
  });

  it('should not update the comment if the data in the request body is incorrect (the content field is more than 300 characters long).', async () => {
    // 🔻 Создаём блог
    const [createdBlog]: BlogViewDto[] = await blogsTestManager.createBlog(1);
    // 🔻 Создаём пост в этом блоге
    const [createdPost]: PostViewDto[] = await postsTestManager.createPost(1, createdBlog.id);
    // 🔻 Создаём пользователя
    const [createdUser]: UserViewDto[] = await usersTestManager.createUser(1);
    // 🔻 Логинимся под этим пользователем и получаем токены авторизации
    const [resultLogin]: TestResultLogin[] = await usersTestManager.login([createdUser.login]);
    // 🔻 Создаём комментарий к посту от имени авторизованного пользователя
    const [createdComment]: CommentViewDto[] = await commentsTestManager.createComment(
      1,
      createdPost.id,
      resultLogin.authTokens.accessToken,
    );

    // 🔻 Генерируем строку длиной 301 символ, что превышает максимально допустимое значение (300 символов)
    const content: string = TestUtils.generateRandomString(301);

    // 🔻 Отправляем PUT-запрос на обновление комментария с контентом недопустимой длины
    // 🔻 Ожидаем 400 Bad Request, так как длина "content" превышает максимально допустимое значение
    const resUpdateComment: Response = await request(server)
      .put(`/${GLOBAL_PREFIX}/comments/${createdComment.id}`)
      .set('Authorization', `Bearer ${resultLogin.authTokens.accessToken}`)
      .send({ content })
      .expect(HttpStatus.BAD_REQUEST);

    // 🔻 Проверяем, что тело ответа содержит корректное сообщение об ошибке для поля "content"
    expect(resUpdateComment.body).toEqual({
      errorsMessages: [
        {
          field: 'content',
          message: `content must be shorter than or equal to 300 characters; Received value: ${content}`,
        },
      ],
    });

    // 🔻 Получаем комментарий заново после попытки обновления
    const newlyCreatedComment: CommentViewDto = await commentsTestManager.getById(
      createdComment.id,
    );

    // 🔻 Проверяем, что комментарий не изменился
    expect(createdComment).toEqual(newlyCreatedComment);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resUpdateComment.body,
        resUpdateComment.statusCode,
        'Test №6: CommentsController - updateComment() (PUT: /comments/:id)',
      );
    }
  });

  it('should not update comments if the user in question is not the owner of the comment.', async () => {
    // 🔻 Создаём блог
    const [createdBlog]: BlogViewDto[] = await blogsTestManager.createBlog(1);
    // 🔻 Создаём пост в этом блоге
    const [createdPost]: PostViewDto[] = await postsTestManager.createPost(1, createdBlog.id);
    // 🔻 Создаём двух пользователей
    const [createdUser_1, createdUser_2]: UserViewDto[] = await usersTestManager.createUser(2);
    // 🔻 Логинимся под обоими пользователями и получаем их токены авторизации
    const [resultLogin_1, resultLogin_2]: TestResultLogin[] = await usersTestManager.login([
      createdUser_1.login,
      createdUser_2.login,
    ]);
    // 🔻 Создаём комментарий от имени первого пользователя
    const [createdComment]: CommentViewDto[] = await commentsTestManager.createComment(
      1,
      createdPost.id,
      resultLogin_1.authTokens.accessToken,
    );

    // 🔻 Определяем новый контент для комментария
    const newContent: string = 'update content comment';

    // 🔻 Пытаемся обновить комментарий от имени второго пользователя
    // 🔻 Ожидаем 403 Forbidden, так как пользователь не является владельцем комментария
    const resUpdateComment: Response = await request(server)
      .put(`/${GLOBAL_PREFIX}/comments/${createdComment.id}`)
      .set('Authorization', `Bearer ${resultLogin_2.authTokens.accessToken}`)
      .send({ content: newContent })
      .expect(HttpStatus.FORBIDDEN);

    // 🔻 Получаем комментарий заново
    const newlyCreatedComment: CommentViewDto = await commentsTestManager.getById(
      createdComment.id,
    );

    // 🔻 Проверяем, что комментарий не изменился
    expect(createdComment).toEqual(newlyCreatedComment);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resUpdateComment.body,
        resUpdateComment.statusCode,
        'Test №7: CommentsController - updateComment() (PUT: /comments/:id)',
      );
    }
  });

  it('should not update comments if the comment does not exist.', async () => {
    // 🔻 Создаём блог
    const [createdBlog]: BlogViewDto[] = await blogsTestManager.createBlog(1);
    // 🔻 Создаём пост в этом блоге
    const [createdPost]: PostViewDto[] = await postsTestManager.createPost(1, createdBlog.id);
    // 🔻 Создаём пользователя
    const [createdUser]: UserViewDto[] = await usersTestManager.createUser(1);
    // 🔻 Логинимся под этим пользователем и получаем токены авторизации
    const [resultLogin]: TestResultLogin[] = await usersTestManager.login([createdUser.login]);
    // 🔻 Создаём комментарий к посту от имени авторизованного пользователя
    const [createdComment]: CommentViewDto[] = await commentsTestManager.createComment(
      1,
      createdPost.id,
      resultLogin.authTokens.accessToken,
    );

    // 🔻 Определяем новый контент для комментария
    const newContent: string = 'update content comment';
    // 🔻 Определяем несуществующий ID комментария
    const incorrectCommentId: string = '10000000';

    // 🔻 Отправляем PUT-запрос на обновление комментария по несуществующему ID
    // 🔻 Ожидаем 404 Not Found, потому что комментарий с таким ID отсутствует в базе
    const resUpdateComment: Response = await request(server)
      .put(`/${GLOBAL_PREFIX}/comments/${incorrectCommentId}`)
      .set('Authorization', `Bearer ${resultLogin.authTokens.accessToken}`)
      .send({ content: newContent })
      .expect(HttpStatus.NOT_FOUND);

    // 🔻 Получаем исходный комментарий
    const newlyCreatedComment: CommentViewDto = await commentsTestManager.getById(
      createdComment.id,
    );

    // 🔻 Проверяем, что комментарий не изменился
    expect(createdComment).toEqual(newlyCreatedComment);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resUpdateComment.body,
        resUpdateComment.statusCode,
        'Test №8: CommentsController - updateComment() (PUT: /comments/:id)',
      );
    }
  });
});
