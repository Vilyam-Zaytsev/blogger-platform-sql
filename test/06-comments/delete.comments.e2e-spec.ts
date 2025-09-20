import request, { Response } from 'supertest';
import { TestUtils } from '../helpers/test.utils';
import { GLOBAL_PREFIX } from '../../src/setup/global-prefix.setup';
import { TestLoggers } from '../helpers/test.loggers';
import { AppTestManager } from '../managers/app.test-manager';
import { AdminCredentials, TestResultLogin } from '../types';
import { Server } from 'http';
import { BlogViewDto } from 'src/modules/bloggers-platform/blogs/api/view-dto/blog-view.dto';
import { BlogsTestManager } from '../managers/blogs.test-manager';
import { HttpStatus } from '@nestjs/common';
import { PostViewDto } from '../../src/modules/bloggers-platform/posts/api/view-dto/post.view-dto';
import { PostsTestManager } from '../managers/posts.test-manager';
import { UsersTestManager } from '../managers/users.test-manager';
import { CommentViewDto } from '../../src/modules/bloggers-platform/comments/api/view-dto/comment-view.dto';
import { CommentsTestManager } from '../managers/comments.test-manager';
import { UserAccountsConfig } from '../../src/modules/user-accounts/config/user-accounts.config';
import { JwtService } from '@nestjs/jwt';
import { PaginatedViewDto } from '../../src/core/dto/paginated.view-dto';
import { ACCESS_TOKEN_STRATEGY_INJECT_TOKEN } from '../../src/modules/user-accounts/auth/constants/auth-tokens.inject-constants';
import { UserViewDto } from '../../src/modules/user-accounts/users/api/view-dto/user.view-dto';

describe('CommentsController - deleteComment() (DELETE: /comments/:id)', () => {
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

  it('should delete the comment if the user is logged in.', async () => {
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

    // 🔻 Отправляем DELETE-запрос на удаление комментария
    // 🔻 Ожидаем 204 No Content, так как авторизованный пользователь является его автором
    const resDeleteComment: Response = await request(server)
      .delete(`/${GLOBAL_PREFIX}/comments/${createdComment.id}`)
      .set('Authorization', `Bearer ${resultLogin.authTokens.accessToken}`)
      .expect(HttpStatus.NO_CONTENT);

    // 🔻 Получаем список комментариев к посту
    const comments: PaginatedViewDto<CommentViewDto> = await commentsTestManager.getAll(
      createdPost.id,
    );

    // 🔻 Проверяем, что комментариев больше нет (длина массива 0)
    expect(comments.items.length).toEqual(0);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resDeleteComment.body,
        resDeleteComment.statusCode,
        'Test №1: CommentsController - deleteComment() (DELETE: /comments/:id)',
      );
    }
  });

  it('should not delete the comment if the user is not logged in.', async () => {
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

    // 🔻 Делаем паузу 3 секунды (имитация протухания или недействительности токена авторизации)
    await TestUtils.delay(3000);

    // 🔻 Отправляем DELETE-запрос на удаление комментария с недействительным токеном
    // 🔻 Ожидаем 401 Unauthorized, потому что пользователь не авторизован (или токен просрочен)
    const resDeleteComment: Response = await request(server)
      .delete(`/${GLOBAL_PREFIX}/comments/${createdComment.id}`)
      .set('Authorization', `Bearer ${resultLogin.authTokens.accessToken}`)
      .expect(HttpStatus.UNAUTHORIZED);

    // 🔻 Получаем список комментариев к посту
    const comments: PaginatedViewDto<CommentViewDto> = await commentsTestManager.getAll(
      createdPost.id,
    );

    // 🔻 Проверяем, что комментарий остался и совпадает с исходным
    expect(comments.items.length).toEqual(1);
    expect(comments.items[0]).toEqual(createdComment);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resDeleteComment.body,
        resDeleteComment.statusCode,
        'Test №2: CommentsController - deleteComment() (DELETE: /comments/:id)',
      );
    }
  });

  it('should not delete comments if the user in question is not the owner of the comment.', async () => {
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

    // 🔻 Отправляем DELETE-запрос на удаление комментария от имени второго пользователя
    // 🔻 Ожидаем 403 Forbidden, потому что пользователь не является владельцем комментария
    const resDeleteComment: Response = await request(server)
      .delete(`/${GLOBAL_PREFIX}/comments/${createdComment.id}`)
      .set('Authorization', `Bearer ${resultLogin_2.authTokens.accessToken}`)
      .expect(HttpStatus.FORBIDDEN);

    // 🔻 Получаем список комментариев к посту
    const comments: PaginatedViewDto<CommentViewDto> = await commentsTestManager.getAll(
      createdPost.id,
    );

    // 🔻 Проверяем, что комментарий остался и совпадает с исходным
    expect(comments.items.length).toEqual(1);
    expect(comments.items[0]).toEqual(createdComment);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resDeleteComment.body,
        resDeleteComment.statusCode,
        'Test №3: CommentsController - deleteComment() (DELETE: /comments/:id)',
      );
    }
  });

  it('should not delete comments if the comment does not exist.', async () => {
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
    // 🔻 Определяем несуществующий ID комментария
    const incorrectCommentId: string = '1000000';

    // 🔻 Отправляем DELETE-запрос на удаление комментария с несуществующим ID
    // 🔻 Ожидаем 404 Not Found, потому что комментарий с таким ID отсутствует в базе
    const resDeleteComment: Response = await request(server)
      .delete(`/${GLOBAL_PREFIX}/comments/${incorrectCommentId}`)
      .set('Authorization', `Bearer ${resultLogin.authTokens.accessToken}`)
      .expect(HttpStatus.NOT_FOUND);

    // 🔻 Получаем список комментариев к посту
    const comments: PaginatedViewDto<CommentViewDto> = await commentsTestManager.getAll(
      createdPost.id,
    );

    // 🔻 Проверяем, что комментарий изначально созданный всё ещё существует
    expect(comments.items.length).toEqual(1);
    expect(comments.items[0]).toEqual(createdComment);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resDeleteComment.body,
        resDeleteComment.statusCode,
        'Test №4: CommentsController - deleteComment() (DELETE: /comments/:id)',
      );
    }
  });
});
