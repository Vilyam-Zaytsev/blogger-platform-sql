import request, { Response } from 'supertest';
import { TestUtils } from '../helpers/test.utils';
import { GLOBAL_PREFIX } from '../../src/setup/global-prefix.setup';
import { TestLoggers } from '../helpers/test.loggers';
import { AppTestManager } from '../managers/app.test-manager';
import { AdminCredentials, TestResultLogin } from '../types';
import { Server } from 'http';
import { BlogsTestManager } from '../managers/blogs.test-manager';
import { PostViewDto } from '../../src/modules/bloggers-platform/posts/api/view-dto/post.view-dto';
import { PostsTestManager } from '../managers/posts.test-manager';
import { UsersTestManager } from '../managers/users.test-manager';
import { HttpStatus } from '@nestjs/common';
import { PaginatedViewDto } from '../../src/core/dto/paginated.view-dto';
import { Filter } from '../helpers/filter';
import { GetPostsQueryParams } from '../../src/modules/bloggers-platform/posts/api/input-dto/get-posts-query-params.input-dto';
import { UserAccountsConfig } from '../../src/modules/user-accounts/config/user-accounts.config';
import { JwtService } from '@nestjs/jwt';
import { CommentsTestManager } from '../managers/comments.test-manager';
import { CommentViewDto } from '../../src/modules/bloggers-platform/comments/api/view-dto/comment-view.dto';
import { CoreConfig } from '../../src/core/core.config';
import { ConfigService } from '@nestjs/config';
import { ACCESS_TOKEN_STRATEGY_INJECT_TOKEN } from '../../src/modules/user-accounts/auth/constants/auth-tokens.inject-constants';
import { UserViewDto } from '../../src/modules/user-accounts/users/api/view-dto/user.view-dto';
import { SortDirection } from '../../src/core/dto/base.query-params.input-dto';
import { BlogViewDto } from '../../src/modules/bloggers-platform/blogs/api/view-dto/blog.view-dto';
import { ReactionStatus } from '../../src/modules/bloggers-platform/reactions/domain/entities/reaction.entity';

describe('CommentsController - updateReaction() (PUT: /comments/:commentId/like-status)', () => {
  let appTestManager: AppTestManager;
  let blogsTestManager: BlogsTestManager;
  let postsTestManager: PostsTestManager;
  let commentsTestManager: CommentsTestManager;
  let usersTestManager: UsersTestManager;
  let adminCredentials: AdminCredentials;
  let adminCredentialsInBase64: string;
  let testLoggingEnabled: boolean;
  let server: Server;

  beforeAll(async () => {
    appTestManager = new AppTestManager();
    await appTestManager.init((moduleBuilder) =>
      moduleBuilder
        .overrideProvider(CoreConfig)
        .useFactory({
          factory: (configService: ConfigService<any, true>) => {
            const coreConfig = new CoreConfig(configService);
            coreConfig.throttleLimit = 10000;
            coreConfig.throttleTtl = 15;

            return coreConfig;
          },
          inject: [ConfigService],
        })
        .overrideProvider(ACCESS_TOKEN_STRATEGY_INJECT_TOKEN)
        .useFactory({
          factory: (userAccountsConfig: UserAccountsConfig) => {
            return new JwtService({
              secret: userAccountsConfig.accessTokenSecret,
              signOptions: { expiresIn: '3s' },
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

  it('should update the user\'s "like" reaction and increase the number of similar reactions(№1).', async () => {
    // 🔻 Создаём блог
    const [createdBlog]: BlogViewDto[] = await blogsTestManager.createBlog(1);
    // 🔻 Создаём пост в этом блоге
    const [createdPost]: PostViewDto[] = await postsTestManager.createPost(1, createdBlog.id);
    // 🔻 Создаём пользователя
    const [createdUser]: UserViewDto[] = await usersTestManager.createUser(1);
    // 🔻 Логинимся под этим пользователем и получаем токены
    const [resultLogin]: TestResultLogin[] = await usersTestManager.login([createdUser.login]);
    // 🔻 Создаём комментарий к посту с авторизацией пользователя
    const [createdComment]: CommentViewDto[] = await commentsTestManager.createComment(
      1,
      createdPost.id,
      resultLogin.authTokens.accessToken,
    );

    // 🔻 Пользователь отправляет PUT-запрос на установку лайка к комментарию
    // 🔻 Ожидает 204 No Content
    const resUpdateReaction: Response = await request(server)
      .put(`/${GLOBAL_PREFIX}/comments/${createdComment.id}/like-status`)
      .set('Authorization', `Bearer ${resultLogin.authTokens.accessToken}`)
      .send({ likeStatus: ReactionStatus.Like })
      .expect(HttpStatus.NO_CONTENT);

    // 🔻 Получаем комментарий без авторизации, проверяем лайки, дизлайки и myStatus (None)
    const foundComment_1: CommentViewDto = await commentsTestManager.getById(createdComment.id);

    expect(foundComment_1.likesInfo).toEqual({
      likesCount: 1,
      dislikesCount: 0,
      myStatus: ReactionStatus.None,
    });

    // 🔻 Получаем комментарий с авторизацией пользователя, проверяем лайки и myStatus (Like)
    const foundComment_2: CommentViewDto = await commentsTestManager.getById(
      createdComment.id,
      resultLogin.authTokens.accessToken,
    );

    expect(foundComment_2.likesInfo).toEqual({
      likesCount: 1,
      dislikesCount: 0,
      myStatus: ReactionStatus.Like,
    });

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resUpdateReaction.body,
        resUpdateReaction.statusCode,
        'Test №1: CommentsController - updateReaction() (PUT: /comments/:commentId/like-status)',
      );
    }
  });

  it('should update the user\'s "like" reaction and increase the number of similar reactions(№2).', async () => {
    // 🔻 Создаём блог
    const [createdBlog]: BlogViewDto[] = await blogsTestManager.createBlog(1);
    // 🔻 Создаём пост в блоге
    const [createdPost]: PostViewDto[] = await postsTestManager.createPost(1, createdBlog.id);
    // 🔻 Создаём двух пользователей
    const createdUsers: UserViewDto[] = await usersTestManager.createUser(2);
    // 🔻 Логинимся под обоими пользователями
    const resultLogin: TestResultLogin[] = await usersTestManager.login(
      createdUsers.map((u) => u.login),
    );
    // 🔻 Создаём комментарий к посту от первого пользователя
    const [createdComment]: CommentViewDto[] = await commentsTestManager.createComment(
      1,
      createdPost.id,
      resultLogin[0].authTokens.accessToken,
    );

    // 🔻 Каждый из пользователей ставит лайк комментарию
    const resUpdateReaction: Response[] = [];

    for (let i = 0; i < resultLogin.length; i++) {
      const res: Response = await request(server)
        .put(`/${GLOBAL_PREFIX}/comments/${createdComment.id}/like-status`)
        .set('Authorization', `Bearer ${resultLogin[i].authTokens.accessToken}`)
        .send({ likeStatus: ReactionStatus.Like })
        .expect(HttpStatus.NO_CONTENT);

      resUpdateReaction.push(res);
    }

    // 🔻 Получаем комментарий без авторизации и проверяем количество лайков, дизлайков и myStatus
    const foundComment_1: CommentViewDto = await commentsTestManager.getById(createdComment.id);

    expect(foundComment_1.likesInfo).toEqual({
      likesCount: 2,
      dislikesCount: 0,
      myStatus: ReactionStatus.None,
    });

    // 🔻 Для каждого пользователя получаем комментарий с авторизацией и проверяем myStatus и количество лайков
    for (let i = 0; i < resultLogin.length; i++) {
      const foundComment: CommentViewDto = await commentsTestManager.getById(
        createdComment.id,
        resultLogin[i].authTokens.accessToken,
      );

      expect(foundComment.likesInfo).toEqual({
        likesCount: 2,
        dislikesCount: 0,
        myStatus: ReactionStatus.Like,
      });
    }

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resUpdateReaction[0].body,
        resUpdateReaction[0].statusCode,
        'Test №2: CommentsController - updateReaction() (PUT: /comments/:commentId/like-status)',
      );
    }
  });

  it('should update the user\'s "like" reaction and increase the number of similar reactions(№3).', async () => {
    // 🔻 Создаём блог
    const [createdBlog]: BlogViewDto[] = await blogsTestManager.createBlog(1);
    // 🔻 Создаём пост в блоге
    const [createdPost]: PostViewDto[] = await postsTestManager.createPost(1, createdBlog.id);
    // 🔻 Создаём трёх пользователей
    const createdUsers: UserViewDto[] = await usersTestManager.createUser(3);
    // 🔻 Логинимся под всеми тремя пользователями
    const resultLogin: TestResultLogin[] = await usersTestManager.login(
      createdUsers.map((u) => u.login),
    );
    // 🔻 Создаём комментарий к посту от первого пользователя
    const [createdComment]: CommentViewDto[] = await commentsTestManager.createComment(
      1,
      createdPost.id,
      resultLogin[0].authTokens.accessToken,
    );

    // 🔻 Каждый из пользователей ставит лайк комментарию
    const resUpdateReaction: Response[] = [];

    for (let i = 0; i < resultLogin.length; i++) {
      const res: Response = await request(server)
        .put(`/${GLOBAL_PREFIX}/comments/${createdComment.id}/like-status`)
        .set('Authorization', `Bearer ${resultLogin[i].authTokens.accessToken}`)
        .send({ likeStatus: ReactionStatus.Like })
        .expect(HttpStatus.NO_CONTENT);

      resUpdateReaction.push(res);
    }

    // 🔻 Получаем комментарий без авторизации и проверяем количество лайков, дизлайков и myStatus
    const foundComment_1: CommentViewDto = await commentsTestManager.getById(createdComment.id);

    expect(foundComment_1.likesInfo).toEqual({
      likesCount: 3,
      dislikesCount: 0,
      myStatus: ReactionStatus.None,
    });

    // 🔻 Для каждого пользователя получаем комментарий с авторизацией и проверяем myStatus и количество лайков
    for (let i = 0; i < resultLogin.length; i++) {
      const foundComment: CommentViewDto = await commentsTestManager.getById(
        createdComment.id,
        resultLogin[i].authTokens.accessToken,
      );

      expect(foundComment.likesInfo).toEqual({
        likesCount: 3,
        dislikesCount: 0,
        myStatus: ReactionStatus.Like,
      });
    }

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resUpdateReaction[0].body,
        resUpdateReaction[0].statusCode,
        'Test №3: CommentsController - updateReaction() (PUT: /comments/:commentId/like-status)',
      );
    }
  });

  it('should update the user\'s "like" reaction and increase the number of similar reactions(№4).', async () => {
    // 🔻 Создаём блог
    const [createdBlog]: BlogViewDto[] = await blogsTestManager.createBlog(1);
    // 🔻 Создаём пост в блоге
    const [createdPost]: PostViewDto[] = await postsTestManager.createPost(1, createdBlog.id);
    // 🔻 Создаём четырёх пользователей
    const createdUsers: UserViewDto[] = await usersTestManager.createUser(4);
    // 🔻 Логинимся под всеми четырьмя пользователями
    const resultLogin: TestResultLogin[] = await usersTestManager.login(
      createdUsers.map((u) => u.login),
    );
    // 🔻 Создаём комментарий к посту от первого пользователя
    const [createdComment]: CommentViewDto[] = await commentsTestManager.createComment(
      1,
      createdPost.id,
      resultLogin[0].authTokens.accessToken,
    );

    // 🔻 Первые три пользователя ставят лайки к комментарию
    for (let i = 0; i < resultLogin.length - 1; i++) {
      await request(server)
        .put(`/${GLOBAL_PREFIX}/comments/${createdComment.id}/like-status`)
        .set('Authorization', `Bearer ${resultLogin[i].authTokens.accessToken}`)
        .send({ likeStatus: ReactionStatus.Like })
        .expect(HttpStatus.NO_CONTENT);
    }

    // 🔻 Получаем комментарий без авторизации, проверяем лайки, дизлайки, myStatus
    const foundComment_1: CommentViewDto = await commentsTestManager.getById(createdComment.id);

    expect(foundComment_1.likesInfo).toEqual({
      likesCount: 3,
      dislikesCount: 0,
      myStatus: ReactionStatus.None,
    });

    // 🔻 Проверяем комментарий для первых трёх пользователей с авторизацией
    for (let i = 0; i < resultLogin.length - 1; i++) {
      const foundComment: CommentViewDto = await commentsTestManager.getById(
        createdComment.id,
        resultLogin[i].authTokens.accessToken,
      );

      expect(foundComment.likesInfo).toEqual({
        likesCount: 3,
        dislikesCount: 0,
        myStatus: ReactionStatus.Like,
      });
    }

    // 🔻 Четвёртый пользователь ставит лайк к комментарию
    const resUpdateReaction_2: Response = await request(server)
      .put(`/${GLOBAL_PREFIX}/comments/${createdComment.id}/like-status`)
      .set('Authorization', `Bearer ${resultLogin[3].authTokens.accessToken}`)
      .send({ likeStatus: ReactionStatus.Like })
      .expect(HttpStatus.NO_CONTENT);

    // 🔻 Получаем комментарий с авторизацией четвёртого пользователя и проверяем лайки и myStatus
    const foundComment: CommentViewDto = await commentsTestManager.getById(
      createdComment.id,
      resultLogin[3].authTokens.accessToken,
    );

    expect(foundComment.likesInfo).toEqual({
      likesCount: 4,
      dislikesCount: 0,
      myStatus: ReactionStatus.Like,
    });

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resUpdateReaction_2.body,
        resUpdateReaction_2.statusCode,
        'Test №4: CommentsController - updateReaction() (PUT: /comments/:commentId/like-status)',
      );
    }
  });

  it('should update the user\'s "dislike" reaction and increase the number of similar reactions(№1).', async () => {
    // 🔻 Создаём блог и один пост
    const [createdBlog]: BlogViewDto[] = await blogsTestManager.createBlog(1);
    const [createdPost]: PostViewDto[] = await postsTestManager.createPost(1, createdBlog.id);
    // 🔻 Создаём пользователя и логинимся под ним
    const [createdUser]: UserViewDto[] = await usersTestManager.createUser(1);
    const [resultLogin]: TestResultLogin[] = await usersTestManager.login([createdUser.login]);
    // 🔻 Создаём комментарий к посту с использованием accessToken пользователя
    const [createdComment]: CommentViewDto[] = await commentsTestManager.createComment(
      1,
      createdPost.id,
      resultLogin.authTokens.accessToken,
    );

    // 🔻 Отправляем PUT-запрос для обновления реакции комментария на значение "Dislike"
    const resUpdateReaction: Response = await request(server)
      .put(`/${GLOBAL_PREFIX}/comments/${createdComment.id}/like-status`)
      .set('Authorization', `Bearer ${resultLogin.authTokens.accessToken}`)
      .send({ likeStatus: ReactionStatus.Dislike })
      .expect(HttpStatus.NO_CONTENT);

    // 🔻 Получаем комментарий без авторизации и проверяем, что количество лайков 0, дизлайков 1, а статус пользователя неактивен (None)
    const foundComment_1: CommentViewDto = await commentsTestManager.getById(createdComment.id);

    expect(foundComment_1.likesInfo).toEqual({
      likesCount: 0,
      dislikesCount: 1,
      myStatus: ReactionStatus.None,
    });

    // 🔻 Получаем комментарий с авторизацией и проверяем, что количество лайков и дизлайков осталось, но статус пользователя изменился на "Dislike"
    const foundComment_2: CommentViewDto = await commentsTestManager.getById(
      createdComment.id,
      resultLogin.authTokens.accessToken,
    );

    expect(foundComment_2.likesInfo).toEqual({
      likesCount: 0,
      dislikesCount: 1,
      myStatus: ReactionStatus.Dislike,
    });

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resUpdateReaction.body,
        resUpdateReaction.statusCode,
        'Test №5: CommentsController - updateReaction() (PUT: /comments/:commentId/like-status)',
      );
    }
  });

  it('should update the user\'s "dislike" reaction and increase the number of similar reactions(№2).', async () => {
    // 🔻 Создаём блог и один пост
    const [createdBlog]: BlogViewDto[] = await blogsTestManager.createBlog(1);
    const [createdPost]: PostViewDto[] = await postsTestManager.createPost(1, createdBlog.id);
    // 🔻 Создаём двух пользователей и логинимся под ними
    const createdUsers: UserViewDto[] = await usersTestManager.createUser(2);
    const resultLogin: TestResultLogin[] = await usersTestManager.login(
      createdUsers.map((u) => u.login),
    );
    // 🔻 Создаём комментарий к посту с accessToken первого пользователя
    const [createdComment]: CommentViewDto[] = await commentsTestManager.createComment(
      1,
      createdPost.id,
      resultLogin[0].authTokens.accessToken,
    );

    // 🔻 Последовательно обновляем реакцию "Dislike" для каждого пользователя
    const resUpdateReaction: Response[] = [];

    for (let i = 0; i < resultLogin.length; i++) {
      const res: Response = await request(server)
        .put(`/${GLOBAL_PREFIX}/comments/${createdComment.id}/like-status`)
        .set('Authorization', `Bearer ${resultLogin[i].authTokens.accessToken}`)
        .send({ likeStatus: ReactionStatus.Dislike })
        .expect(HttpStatus.NO_CONTENT);

      resUpdateReaction.push(res);
    }

    // 🔻 Получаем комментарий без авторизации и проверяем, что дизлайков стало 2, лайков 0, статус текущего пользователя - None
    const foundComment_1: CommentViewDto = await commentsTestManager.getById(createdComment.id);

    expect(foundComment_1.likesInfo).toEqual({
      likesCount: 0,
      dislikesCount: 2,
      myStatus: ReactionStatus.None,
    });

    // 🔻 Для каждого пользователя с авторизацией проверяем количество дизлайков и статус "Dislike"
    for (let i = 0; i < resultLogin.length; i++) {
      const foundComment: CommentViewDto = await commentsTestManager.getById(
        createdComment.id,
        resultLogin[i].authTokens.accessToken,
      );

      expect(foundComment.likesInfo).toEqual({
        likesCount: 0,
        dislikesCount: 2,
        myStatus: ReactionStatus.Dislike,
      });
    }

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resUpdateReaction[0].body,
        resUpdateReaction[0].statusCode,
        'Test №6: CommentsController - updateReaction() (PUT: /comments/:commentId/like-status)',
      );
    }
  });

  it('should update "None" to "Like", "Like" to "Dislike", "Dislike to "Like", "Like" to "None".', async () => {
    // 🔻 Создаём блог и один пост
    const [createdBlog]: BlogViewDto[] = await blogsTestManager.createBlog(1);
    const [createdPost]: PostViewDto[] = await postsTestManager.createPost(1, createdBlog.id);
    // 🔻 Создаём пользователя и логинимся под ним
    const [createdUser]: UserViewDto[] = await usersTestManager.createUser(1);
    const [resultLogin]: TestResultLogin[] = await usersTestManager.login([createdUser.login]);
    // 🔻 Создаём комментарий к посту с использованием accessToken пользователя
    const [createdComment]: CommentViewDto[] = await commentsTestManager.createComment(
      1,
      createdPost.id,
      resultLogin.authTokens.accessToken,
    );

    // 🔻 Обновляем реакцию с "None" на "Like" и проверить обновление лайков
    const resUpdateReaction: Response = await request(server)
      .put(`/${GLOBAL_PREFIX}/comments/${createdComment.id}/like-status`)
      .set('Authorization', `Bearer ${resultLogin.authTokens.accessToken}`)
      .send({ likeStatus: ReactionStatus.Like })
      .expect(HttpStatus.NO_CONTENT);

    const foundComment_1: CommentViewDto = await commentsTestManager.getById(
      createdComment.id,
      resultLogin.authTokens.accessToken,
    );

    expect(foundComment_1.likesInfo).toEqual({
      likesCount: 1,
      dislikesCount: 0,
      myStatus: ReactionStatus.Like,
    });

    // 🔻 Обновляем реакцию с "Like" на "Dislike" и проверить обновление дизлайков
    await request(server)
      .put(`/${GLOBAL_PREFIX}/comments/${createdComment.id}/like-status`)
      .set('Authorization', `Bearer ${resultLogin.authTokens.accessToken}`)
      .send({ likeStatus: ReactionStatus.Dislike })
      .expect(HttpStatus.NO_CONTENT);

    const foundComment_2: CommentViewDto = await commentsTestManager.getById(
      createdComment.id,
      resultLogin.authTokens.accessToken,
    );

    expect(foundComment_2.likesInfo).toEqual({
      likesCount: 0,
      dislikesCount: 1,
      myStatus: ReactionStatus.Dislike,
    });

    // 🔻 Обновляем реакцию с "Dislike" на "Like" и проверить обновление лайков
    await request(server)
      .put(`/${GLOBAL_PREFIX}/comments/${createdComment.id}/like-status`)
      .set('Authorization', `Bearer ${resultLogin.authTokens.accessToken}`)
      .send({ likeStatus: ReactionStatus.Like })
      .expect(HttpStatus.NO_CONTENT);

    const foundComment_3: CommentViewDto = await commentsTestManager.getById(
      createdComment.id,
      resultLogin.authTokens.accessToken,
    );

    expect(foundComment_3.likesInfo).toEqual({
      likesCount: 1,
      dislikesCount: 0,
      myStatus: ReactionStatus.Like,
    });

    // 🔻 Обновляем реакцию с "Like" на "None" и проверить сброс счётчиков
    await request(server)
      .put(`/${GLOBAL_PREFIX}/comments/${createdComment.id}/like-status`)
      .set('Authorization', `Bearer ${resultLogin.authTokens.accessToken}`)
      .send({ likeStatus: ReactionStatus.None })
      .expect(HttpStatus.NO_CONTENT);

    const foundComment_4: CommentViewDto = await commentsTestManager.getById(
      createdComment.id,
      resultLogin.authTokens.accessToken,
    );

    expect(foundComment_4.likesInfo).toEqual({
      likesCount: 0,
      dislikesCount: 0,
      myStatus: ReactionStatus.None,
    });

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resUpdateReaction.body,
        resUpdateReaction.statusCode,
        'Test №7: CommentsController - updateReaction() (PUT: /comments/:commentId/like-status)',
      );
    }
  });

  it('1. The first five posts: user 1 - puts likes; user 2 - puts dislikes. 2. The following five posts: user 1 - dislikes; user 2 - likes.', async () => {
    // 🔻 Создаём блог и один пост
    const [createdBlog]: BlogViewDto[] = await blogsTestManager.createBlog(1);
    const [createdPost]: PostViewDto[] = await postsTestManager.createPost(1, createdBlog.id);
    // 🔻 Создаём двух пользователей и логинимся под ними
    const [createUser1, createUser2]: UserViewDto[] = await usersTestManager.createUser(2);
    const resultLogins: TestResultLogin[] = await usersTestManager.login([
      createUser1.login,
      createUser2.login,
    ]);
    // 🔻 Создаём 10 комментариев к посту с использованием первого пользователя
    const createdComments: CommentViewDto[] = await commentsTestManager.createComment(
      10,
      createdPost.id,
      resultLogins[0].authTokens.accessToken,
    );

    // 🔻 Первые 5 комментариев: user 1 ставит Like, user 2 ставит Dislike
    // 🔻 Следующие 5 комментариев: user 1 ставит Dislike, user 2 ставит Like
    for (let i = 0; i < createdComments.length; i++) {
      if (createdComments.length / 2 > i) {
        await request(server)
          .put(`/${GLOBAL_PREFIX}/comments/${createdComments[i].id}/like-status`)
          .set('Authorization', `Bearer ${resultLogins[0].authTokens.accessToken}`)
          .send({ likeStatus: ReactionStatus.Like })
          .expect(HttpStatus.NO_CONTENT);

        await request(server)
          .put(`/${GLOBAL_PREFIX}/comments/${createdComments[i].id}/like-status`)
          .set('Authorization', `Bearer ${resultLogins[1].authTokens.accessToken}`)
          .send({ likeStatus: ReactionStatus.Dislike })
          .expect(HttpStatus.NO_CONTENT);
      } else {
        await request(server)
          .put(`/${GLOBAL_PREFIX}/comments/${createdComments[i].id}/like-status`)
          .set('Authorization', `Bearer ${resultLogins[0].authTokens.accessToken}`)
          .send({ likeStatus: ReactionStatus.Dislike })
          .expect(HttpStatus.NO_CONTENT);

        await request(server)
          .put(`/${GLOBAL_PREFIX}/comments/${createdComments[i].id}/like-status`)
          .set('Authorization', `Bearer ${resultLogins[1].authTokens.accessToken}`)
          .send({ likeStatus: ReactionStatus.Like })
          .expect(HttpStatus.NO_CONTENT);
      }
    }

    // 🔻 Получаем все комментарии первого пользователя с авторизацией, сортируем и проверяем статусы и счётчики в первых 5 комментариях
    const foundComments_1: PaginatedViewDto<CommentViewDto> = await commentsTestManager.getAll(
      createdPost.id,
      {},
      resultLogins[0].authTokens.accessToken,
    );

    const query: GetPostsQueryParams = new GetPostsQueryParams();
    query.sortDirection = SortDirection.Ascending;
    const sortedComments: CommentViewDto[] = new Filter<CommentViewDto>(foundComments_1.items)
      .sort({ [query.sortBy]: query.sortDirection })
      .getResult();

    for (let i = 0; i < sortedComments.length; i++) {
      if (sortedComments.length / 2 > i) {
        expect(sortedComments[i].likesInfo).toEqual({
          likesCount: 1,
          dislikesCount: 1,
          myStatus: ReactionStatus.Like,
        });
      }
    }

    // 🔻 Получаем все комментарии второго пользователя с авторизацией, сортируем и проверяем статусы и счётчики для первых и следующих 5 комментариев
    const foundComments_2: PaginatedViewDto<CommentViewDto> = await commentsTestManager.getAll(
      createdPost.id,
      {},
      resultLogins[1].authTokens.accessToken,
    );

    query.sortDirection = SortDirection.Ascending;
    const sortedComments_2: CommentViewDto[] = new Filter<CommentViewDto>(foundComments_2.items)
      .sort({ [query.sortBy]: query.sortDirection })
      .getResult();

    for (let i = 0; i < sortedComments_2.length; i++) {
      if (sortedComments_2.length / 2 > i) {
        expect(sortedComments_2[i].likesInfo).toEqual({
          likesCount: 1,
          dislikesCount: 1,
          myStatus: ReactionStatus.Dislike,
        });
      } else {
        expect(sortedComments_2[i].likesInfo).toEqual({
          likesCount: 1,
          dislikesCount: 1,
          myStatus: ReactionStatus.Like,
        });
      }
    }

    // 🔻 Получаем все комментарии без авторизации, сортируем и проверяем, что статусы пользователей отсутствуют, а счётчики лайков и дизлайков равны 1
    const foundComments_3: PaginatedViewDto<CommentViewDto> = await commentsTestManager.getAll(
      createdPost.id,
    );

    query.sortDirection = SortDirection.Ascending;
    const sortedComments_3: CommentViewDto[] = new Filter<CommentViewDto>(foundComments_3.items)
      .sort({ [query.sortBy]: query.sortDirection })
      .getResult();

    for (let i = 0; i < sortedComments_3.length; i++) {
      if (sortedComments_3.length / 2 > i) {
        expect(sortedComments_3[i].likesInfo).toEqual({
          likesCount: 1,
          dislikesCount: 1,
          myStatus: ReactionStatus.None,
        });
      } else {
        expect(sortedComments_3[i].likesInfo).toEqual({
          likesCount: 1,
          dislikesCount: 1,
          myStatus: ReactionStatus.None,
        });
      }
    }

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        {},
        HttpStatus.NO_CONTENT,
        'Test №8: CommentsController - updateReaction() (PUT: /comments/:commentId/like-status)',
      );
    }
  });

  it('1. must create ten users. 2. All ten users like one post. 3.Then each user changes the like to dislike reaction. newestLikes should change along with this.', async () => {
    // 🔻 Создаём блог и один пост
    const [createdBlog]: BlogViewDto[] = await blogsTestManager.createBlog(1);
    const [createdPost]: PostViewDto[] = await postsTestManager.createPost(1, createdBlog.id);
    // 🔻 Создаём десять пользователей и логинимся под ними
    const createdUsers: UserViewDto[] = await usersTestManager.createUser(10);
    const resultLogins: TestResultLogin[] = await usersTestManager.login(
      createdUsers.map((user) => user.login),
    );
    // 🔻 Создаём один комментарий к посту от первого пользователя
    const [createdComment]: CommentViewDto[] = await commentsTestManager.createComment(
      1,
      createdPost.id,
      resultLogins[0].authTokens.accessToken,
    );

    // 🔻 Все десять пользователей ставят реакцию "Like" на комментарий
    for (let i = 0; i < resultLogins.length; i++) {
      await request(server)
        .put(`/${GLOBAL_PREFIX}/comments/${createdComment.id}/like-status`)
        .set('Authorization', `Bearer ${resultLogins[i].authTokens.accessToken}`)
        .send({ likeStatus: ReactionStatus.Like })
        .expect(HttpStatus.NO_CONTENT);
    }

    // 🔻 Получаем комментарий без авторизации и проверяем, что лайков стало 10, дизлайков 0, статус текущего пользователя "None"
    const foundComment: CommentViewDto = await commentsTestManager.getById(createdComment.id);

    expect(foundComment.likesInfo).toEqual({
      likesCount: 10,
      dislikesCount: 0,
      myStatus: ReactionStatus.None,
    });

    // 🔻 Последовательно каждый пользователь меняет свою реакцию с "Like" на "Dislike"
    // 🔻 После каждого изменения проверяем корректность счётчиков и статуса для текущего пользователя
    for (let i = resultLogins.length - 1; i >= 0; i--) {
      await request(server)
        .put(`/${GLOBAL_PREFIX}/comments/${createdComment.id}/like-status`)
        .set('Authorization', `Bearer ${resultLogins[i].authTokens.accessToken}`)
        .send({ likeStatus: ReactionStatus.Dislike })
        .expect(HttpStatus.NO_CONTENT);

      const foundComment: CommentViewDto = await commentsTestManager.getById(
        createdComment.id,
        resultLogins[i].authTokens.accessToken,
      );

      const dislikesCount: number = resultLogins.length - i;

      expect(foundComment.likesInfo).toEqual({
        likesCount: 10 - dislikesCount,
        dislikesCount,
        myStatus: ReactionStatus.Dislike,
      });
    }

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        {},
        HttpStatus.NO_CONTENT,
        'Test №9: CommentsController - updateReaction() (PUT: /comments/:commentId/like-status)',
      );
    }
  });

  it('should return a 401 if the user is not logged in.', async () => {
    // 🔻 Создаём блог и один пост
    const [createdBlog]: BlogViewDto[] = await blogsTestManager.createBlog(1);
    const [createdPost]: PostViewDto[] = await postsTestManager.createPost(1, createdBlog.id);
    // 🔻 Создаём пользователя и логинимся под ним
    const [createdUser]: UserViewDto[] = await usersTestManager.createUser(1);
    const [resultLogin]: TestResultLogin[] = await usersTestManager.login([createdUser.login]);
    // 🔻 Создаём комментарий к посту с использованием accessToken пользователя
    const [createdComment]: CommentViewDto[] = await commentsTestManager.createComment(
      1,
      createdPost.id,
      resultLogin.authTokens.accessToken,
    );

    // 🔻 Отправляем PUT-запрос с некорректным токеном авторизации, ожидаем 401 Unauthorized
    const resUpdateReaction: Response = await request(server)
      .put(`/${GLOBAL_PREFIX}/comments/${createdComment.id}/like-status`)
      .set('Authorization', `Bearer incorrect token`)
      .send({ likeStatus: ReactionStatus.Like })
      .expect(HttpStatus.UNAUTHORIZED);

    // 🔻 Получаем комментарий без авторизации, проверяем что лайков и дизлайков нет, статус пользователя "None"
    const foundComment: CommentViewDto = await commentsTestManager.getById(createdComment.id);

    expect(foundComment.likesInfo).toEqual({
      likesCount: 0,
      dislikesCount: 0,
      myStatus: ReactionStatus.None,
    });

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resUpdateReaction.body,
        resUpdateReaction.statusCode,
        'Test №10: CommentsController - updateReaction() (PUT: /comments/:commentId/like-status)',
      );
    }
  });

  it('should return the value 404 if the post the user is trying to review does not exist.', async () => {
    // 🔻 Создаём пользователя и логинимся под ним
    const [createdUser]: UserViewDto[] = await usersTestManager.createUser(1);
    const [resultLogin]: TestResultLogin[] = await usersTestManager.login([createdUser.login]);
    // 🔻 Используем некорректный ID комментария, которого не существует
    const incorrectCommentId: string = '1000000';

    // 🔻 Отправляем PUT-запрос с корректным токеном, но несуществующим id комментария, ожидаем 404 Not Found
    const resUpdateReaction: Response = await request(server)
      .put(`/${GLOBAL_PREFIX}/comments/${incorrectCommentId}/like-status`)
      .set('Authorization', `Bearer ${resultLogin.authTokens.accessToken}`)
      .send({ likeStatus: ReactionStatus.Like })
      .expect(HttpStatus.NOT_FOUND);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resUpdateReaction.body,
        resUpdateReaction.statusCode,
        'Test №11: CommentsController - updateReaction() (PUT: /comments/:commentId/like-status)',
      );
    }
  });

  it('should return 400 if the input data is not valid (an empty object is passed).', async () => {
    // 🔻 Создаём блог и один пост
    const [createdBlog]: BlogViewDto[] = await blogsTestManager.createBlog(1);
    const [createdPost]: PostViewDto[] = await postsTestManager.createPost(1, createdBlog.id);
    // 🔻 Создаём пользователя и логинимся под ним
    const [createdUser]: UserViewDto[] = await usersTestManager.createUser(1);
    const [resultLogin]: TestResultLogin[] = await usersTestManager.login([createdUser.login]);
    // 🔻 Создаём комментарий к посту с использованием accessToken пользователя
    const [createdComment]: CommentViewDto[] = await commentsTestManager.createComment(
      1,
      createdPost.id,
      resultLogin.authTokens.accessToken,
    );

    // 🔻 Отправляем PUT-запрос с пустым объектом в теле, ожидаем 400 Bad Request
    const resUpdateReaction: Response = await request(server)
      .put(`/${GLOBAL_PREFIX}/comments/${createdComment.id}/like-status`)
      .set('Authorization', `Bearer ${resultLogin.authTokens.accessToken}`)
      .send({})
      .expect(HttpStatus.BAD_REQUEST);

    // 🔻 Проверяем тело ответа с описанием ошибки валидации поля likeStatus
    expect(resUpdateReaction.body).toEqual({
      errorsMessages: [
        {
          field: 'likeStatus',
          message:
            'likeStatus must be one of the following values: None, Like, Dislike; Received value: undefined',
        },
      ],
    });

    // 🔻 Проверяем, что состояние реакций комментария осталось без изменений (0 лайков, 0 дизлайков, статус None)
    const foundComment: CommentViewDto = await commentsTestManager.getById(createdComment.id);

    expect(foundComment.likesInfo).toEqual({
      likesCount: 0,
      dislikesCount: 0,
      myStatus: ReactionStatus.None,
    });

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resUpdateReaction.body,
        resUpdateReaction.statusCode,
        'Test №12: CommentsController - updateReaction() (PUT: /comments/:commentId/like-status)',
      );
    }
  });

  it('should return 400 if the input data is not valid (likeStatus differs from other values).', async () => {
    // 🔻 Создаём блог и один пост
    const [createdBlog]: BlogViewDto[] = await blogsTestManager.createBlog(1);
    const [createdPost]: PostViewDto[] = await postsTestManager.createPost(1, createdBlog.id);
    // 🔻 Создаём пользователя и логинимся под ним
    const [createdUser]: UserViewDto[] = await usersTestManager.createUser(1);
    const [resultLogin]: TestResultLogin[] = await usersTestManager.login([createdUser.login]);
    // 🔻 Создаём комментарий к посту с использованием accessToken пользователя
    const [createdComment]: CommentViewDto[] = await commentsTestManager.createComment(
      1,
      createdPost.id,
      resultLogin.authTokens.accessToken,
    );

    // 🔻 Отправляем PUT-запрос с некорректным значением likeStatus, ожидаем 400 Bad Request
    const resUpdateReaction: Response = await request(server)
      .put(`/${GLOBAL_PREFIX}/comments/${createdComment.id}/like-status`)
      .set('Authorization', `Bearer ${resultLogin.authTokens.accessToken}`)
      .send({ likeStatus: 'Likes' })
      .expect(HttpStatus.BAD_REQUEST);

    // 🔻 Проверяем тело ответа с описанием ошибки валидации значения likeStatus
    expect(resUpdateReaction.body).toEqual({
      errorsMessages: [
        {
          field: 'likeStatus',
          message:
            'likeStatus must be one of the following values: None, Like, Dislike; Received value: Likes',
        },
      ],
    });

    // 🔻 Проверяем, что состояние реакций комментария осталось без изменений (0 лайков, 0 дизлайков, статус None)
    const foundComment: CommentViewDto = await commentsTestManager.getById(createdComment.id);

    expect(foundComment.likesInfo).toEqual({
      likesCount: 0,
      dislikesCount: 0,
      myStatus: ReactionStatus.None,
    });

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resUpdateReaction.body,
        resUpdateReaction.statusCode,
        'Test №13: CommentsController - updateReaction() (PUT: /comments/:commentId/like-status)',
      );
    }
  });

  it('should return a 401 error if the user is not logged in (sending an invalid access token)', async () => {
    // 🔻 Создаём блог и один пост
    const [createdBlog]: BlogViewDto[] = await blogsTestManager.createBlog(1);
    const [createdPost]: PostViewDto[] = await postsTestManager.createPost(1, createdBlog.id);
    // 🔻 Создаём пользователя и логинимся под ним
    const [createdUser]: UserViewDto[] = await usersTestManager.createUser(1);
    const [resultLogin]: TestResultLogin[] = await usersTestManager.login([createdUser.login]);
    // 🔻 Создаём комментарий к посту с использованием accessToken пользователя
    const [createdComment]: CommentViewDto[] = await commentsTestManager.createComment(
      1,
      createdPost.id,
      resultLogin.authTokens.accessToken,
    );

    // 🔻 Задержка для симуляции истечения срока действия токена или его невалидности
    await TestUtils.delay(3000);

    // 🔻 Отправляем PUT-запрос с устаревшим/недействительным токеном, ожидаем 401 Unauthorized
    const resUpdateReaction: Response = await request(server)
      .put(`/${GLOBAL_PREFIX}/comments/${createdComment.id}/like-status`)
      .set('Authorization', `Bearer ${resultLogin.authTokens.accessToken}`)
      .send({ likeStatus: ReactionStatus.Like })
      .expect(HttpStatus.UNAUTHORIZED);

    // 🔻 Получаем комментарий без авторизации и проверяем отсутствие изменений в реакциях
    const foundComment_1: CommentViewDto = await commentsTestManager.getById(createdComment.id);

    expect(foundComment_1.likesInfo).toEqual({
      likesCount: 0,
      dislikesCount: 0,
      myStatus: ReactionStatus.None,
    });

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resUpdateReaction.body,
        resUpdateReaction.statusCode,
        'Test №14: CommentsController - updateReaction() (PUT: /comments/:commentId/like-status)',
      );
    }
  });
});
