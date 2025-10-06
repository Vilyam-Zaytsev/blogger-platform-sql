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
import { UserAccountsConfig } from '../../src/modules/user-accounts/config/user-accounts.config';
import { JwtService } from '@nestjs/jwt';
import { ACCESS_TOKEN_STRATEGY_INJECT_TOKEN } from '../../src/modules/user-accounts/auth/constants/auth-tokens.inject-constants';
import { UserViewDto } from '../../src/modules/user-accounts/users/api/view-dto/user.view-dto';
import { Filter } from '../helpers/filter';
import { SortDirection } from '../../src/core/dto/base.query-params.input-dto';
import { PaginatedViewDto } from '../../src/core/dto/paginated.view-dto';
import { GetPostsQueryParams } from '../../src/modules/bloggers-platform/posts/api/input-dto/get-posts-query-params.input-dto';
import { CoreConfig } from '../../src/core/core.config';
import { ConfigService } from '@nestjs/config';
import { BlogViewDto } from '../../src/modules/bloggers-platform/blogs/api/view-dto/blog.view-dto';
import { ReactionStatus } from '../../src/modules/bloggers-platform/reactions/domain/entities/reaction.entity';

describe('PostsController - updateReaction() (PUT: /posts/:postId/like-status)', () => {
  let appTestManager: AppTestManager;
  let blogsTestManager: BlogsTestManager;
  let postsTestManager: PostsTestManager;
  let usersTestManager: UsersTestManager;
  let adminCredentials: AdminCredentials;
  let adminCredentialsInBase64: string;
  let testLoggingEnabled: boolean;
  let server: Server;

  beforeAll(async () => {
    appTestManager = new AppTestManager();
    await appTestManager.init((moduleBuilder) =>
      moduleBuilder
        .overrideProvider(ACCESS_TOKEN_STRATEGY_INJECT_TOKEN)
        .useFactory({
          factory: (userAccountsConfig: UserAccountsConfig) => {
            return new JwtService({
              secret: userAccountsConfig.accessTokenSecret,
              signOptions: { expiresIn: '3s' },
            });
          },
          inject: [UserAccountsConfig],
        })

        .overrideProvider(CoreConfig)
        .useFactory({
          factory: (configService: ConfigService<any, true>) => {
            const coreConfig = new CoreConfig(configService);
            coreConfig.throttleLimit = 10000;
            coreConfig.throttleTtl = 15;

            return coreConfig;
          },
          inject: [ConfigService],
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
  });

  beforeEach(async () => {
    await appTestManager.cleanupDb(['schema_migrations']);

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
    // 🔻 Логинимся под этим пользователем и получаем токены авторизации
    const [resultLogin]: TestResultLogin[] = await usersTestManager.login([createdUser.login]);

    // 🔻 Отправляем PUT-запрос на установку реакции "Like" для поста
    // 🔻 Ожидаем 204 No Content, так как реакция корректно обновлена
    const resUpdateReaction: Response = await request(server)
      .put(`/${GLOBAL_PREFIX}/posts/${createdPost.id}/like-status`)
      .set('Authorization', `Bearer ${resultLogin.authTokens.accessToken}`)
      .send({ likeStatus: ReactionStatus.Like })
      .expect(HttpStatus.NO_CONTENT);

    // 🔻 Получаем пост без авторизации
    // 🔻 Проверяем, что количество лайков увеличилось, но myStatus = None
    const foundPost_1: PostViewDto = await postsTestManager.getPostById(createdPost.id);

    expect(foundPost_1.extendedLikesInfo).toEqual({
      likesCount: 1,
      dislikesCount: 0,
      myStatus: ReactionStatus.None,
      newestLikes: [
        {
          addedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+\+\d{2}:\d{2}$/),
          userId: createdUser.id,
          login: createdUser.login,
        },
      ],
    });

    // 🔻 Получаем пост с авторизацией пользователя, поставившего лайк
    // 🔻 Проверяем, что myStatus = Like и количество лайков совпадает
    const foundPost_2: PostViewDto = await postsTestManager.getPostById(
      createdPost.id,
      resultLogin.authTokens.accessToken,
    );

    expect(foundPost_2.extendedLikesInfo).toEqual({
      likesCount: 1,
      dislikesCount: 0,
      myStatus: ReactionStatus.Like,
      newestLikes: [
        {
          addedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+\+\d{2}:\d{2}$/),
          userId: createdUser.id,
          login: createdUser.login,
        },
      ],
    });

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resUpdateReaction.body,
        resUpdateReaction.statusCode,
        'Test №1: PostsController - updateReaction() (PUT: /posts/:postId/like-status)',
      );
    }
  });

  it('should update the user\'s "like" reaction and increase the number of similar reactions(№2).', async () => {
    // 🔻 Создаём блог
    const [createdBlog]: BlogViewDto[] = await blogsTestManager.createBlog(1);
    // 🔻 Создаём пост в этом блоге
    const [createdPost]: PostViewDto[] = await postsTestManager.createPost(1, createdBlog.id);
    // 🔻 Создаём двух пользователей
    const createdUsers: UserViewDto[] = await usersTestManager.createUser(2);
    // 🔻 Логинимся под обоими пользователями
    const resultLogin: TestResultLogin[] = await usersTestManager.login(
      createdUsers.map((u) => u.login),
    );

    // 🔻 Каждый пользователь отправляет PUT-запрос на установку реакции "Like"
    const resUpdateReaction: Response[] = [];

    for (let i = 0; i < resultLogin.length; i++) {
      const res: Response = await request(server)
        .put(`/${GLOBAL_PREFIX}/posts/${createdPost.id}/like-status`)
        .set('Authorization', `Bearer ${resultLogin[i].authTokens.accessToken}`)
        .send({ likeStatus: ReactionStatus.Like })
        .expect(HttpStatus.NO_CONTENT);

      resUpdateReaction.push(res);
    }

    // 🔻 Получаем пост без авторизации
    // 🔻 Проверяем количества лайков, дизлайков, myStatus и список последних лайков
    const foundPost_1: PostViewDto = await postsTestManager.getPostById(createdPost.id);

    expect(foundPost_1.extendedLikesInfo).toEqual({
      likesCount: 2,
      dislikesCount: 0,
      myStatus: ReactionStatus.None,
      newestLikes: [
        {
          addedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+\+\d{2}:\d{2}$/),
          userId: createdUsers[1].id,
          login: createdUsers[1].login,
        },
        {
          addedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+\+\d{2}:\d{2}$/),
          userId: createdUsers[0].id,
          login: createdUsers[0].login,
        },
      ],
    });

    // 🔻 Для каждого пользователя получаем пост с авторизацией
    // 🔻 Проверяем, что myStatus = Like, лайков 2
    for (let i = 0; i < resultLogin.length; i++) {
      const foundPost: PostViewDto = await postsTestManager.getPostById(
        createdPost.id,
        resultLogin[i].authTokens.accessToken,
      );

      expect(foundPost.extendedLikesInfo).toEqual({
        likesCount: 2,
        dislikesCount: 0,
        myStatus: ReactionStatus.Like,
        newestLikes: [
          {
            addedAt: expect.stringMatching(
              /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+\+\d{2}:\d{2}$/,
            ),
            userId: createdUsers[1].id,
            login: createdUsers[1].login,
          },
          {
            addedAt: expect.stringMatching(
              /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+\+\d{2}:\d{2}$/,
            ),
            userId: createdUsers[0].id,
            login: createdUsers[0].login,
          },
        ],
      });
    }

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resUpdateReaction[0].body,
        resUpdateReaction[0].statusCode,
        'Test №2: PostsController - updateReaction() (PUT: /posts/:postId/like-status)',
      );
    }
  });

  it('should update the user\'s "like" reaction and increase the number of similar reactions(№3).', async () => {
    // 🔻 Создаём блог
    const [createdBlog]: BlogViewDto[] = await blogsTestManager.createBlog(1);
    // 🔻 Создаём пост в этом блоге
    const [createdPost]: PostViewDto[] = await postsTestManager.createPost(1, createdBlog.id);
    // 🔻 Создаём трёх пользователей
    const createdUsers: UserViewDto[] = await usersTestManager.createUser(3);
    // 🔻 Логинимся под всеми тремя пользователями
    const resultLogin: TestResultLogin[] = await usersTestManager.login(
      createdUsers.map((u) => u.login),
    );

    // 🔻 Каждый пользователь отправляет PUT-запрос на установку реакции "Like"
    const resUpdateReaction: Response[] = [];

    for (let i = 0; i < resultLogin.length; i++) {
      const res: Response = await request(server)
        .put(`/${GLOBAL_PREFIX}/posts/${createdPost.id}/like-status`)
        .set('Authorization', `Bearer ${resultLogin[i].authTokens.accessToken}`)
        .send({ likeStatus: ReactionStatus.Like })
        .expect(HttpStatus.NO_CONTENT);

      resUpdateReaction.push(res);
    }

    // 🔻 Получаем пост без авторизации
    // 🔻 Проверяем, что количество лайков = 3, дизлайков = 0, myStatus = None
    // 🔻 newestLikes содержит трёх пользователей с правильным порядком
    const foundPost_1: PostViewDto = await postsTestManager.getPostById(createdPost.id);

    expect(foundPost_1.extendedLikesInfo).toEqual({
      likesCount: 3,
      dislikesCount: 0,
      myStatus: ReactionStatus.None,
      newestLikes: [
        {
          addedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+\+\d{2}:\d{2}$/),
          userId: createdUsers[2].id,
          login: createdUsers[2].login,
        },
        {
          addedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+\+\d{2}:\d{2}$/),
          userId: createdUsers[1].id,
          login: createdUsers[1].login,
        },
        {
          addedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+\+\d{2}:\d{2}$/),
          userId: createdUsers[0].id,
          login: createdUsers[0].login,
        },
      ],
    });

    // 🔻 Для каждого пользователя получаем пост с авторизацией
    // 🔻 Проверяем, что myStatus = Like и количество лайков = 3
    for (let i = 0; i < resultLogin.length; i++) {
      const foundPost: PostViewDto = await postsTestManager.getPostById(
        createdPost.id,
        resultLogin[i].authTokens.accessToken,
      );

      expect(foundPost.extendedLikesInfo).toEqual({
        likesCount: 3,
        dislikesCount: 0,
        myStatus: ReactionStatus.Like,
        newestLikes: [
          {
            addedAt: expect.stringMatching(
              /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+\+\d{2}:\d{2}$/,
            ),
            userId: createdUsers[2].id,
            login: createdUsers[2].login,
          },
          {
            addedAt: expect.stringMatching(
              /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+\+\d{2}:\d{2}$/,
            ),
            userId: createdUsers[1].id,
            login: createdUsers[1].login,
          },
          {
            addedAt: expect.stringMatching(
              /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+\+\d{2}:\d{2}$/,
            ),
            userId: createdUsers[0].id,
            login: createdUsers[0].login,
          },
        ],
      });
    }

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resUpdateReaction[0].body,
        resUpdateReaction[0].statusCode,
        'Test №3: PostsController - updateReaction() (PUT: /posts/:postId/like-status)',
      );
    }
  });

  it('should update the user\'s "like" reaction and increase the number of similar reactions(№4).', async () => {
    // 🔻 Создаём блог
    const [createdBlog]: BlogViewDto[] = await blogsTestManager.createBlog(1);
    // 🔻 Создаём пост в этом блоге
    const [createdPost]: PostViewDto[] = await postsTestManager.createPost(1, createdBlog.id);
    // 🔻 Создаём четырёх пользователей
    const createdUsers: UserViewDto[] = await usersTestManager.createUser(4);
    // 🔻 Логинимся под всеми пользователями
    const resultLogin: TestResultLogin[] = await usersTestManager.login(
      createdUsers.map((u) => u.login),
    );

    // 🔻 Первые три пользователя ставят лайки на пост
    for (let i = 0; i < resultLogin.length - 1; i++) {
      await request(server)
        .put(`/${GLOBAL_PREFIX}/posts/${createdPost.id}/like-status`)
        .set('Authorization', `Bearer ${resultLogin[i].authTokens.accessToken}`)
        .send({ likeStatus: ReactionStatus.Like })
        .expect(HttpStatus.NO_CONTENT);
    }

    // 🔻 Получаем пост без авторизации
    // 🔻 Проверяем, что лайков 3, дизлайков 0, myStatus None, newestLikes с тремя пользователями в правильном порядке
    const foundPost_1: PostViewDto = await postsTestManager.getPostById(createdPost.id);

    expect(foundPost_1.extendedLikesInfo).toEqual({
      likesCount: 3,
      dislikesCount: 0,
      myStatus: ReactionStatus.None,
      newestLikes: [
        {
          addedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+\+\d{2}:\d{2}$/),
          userId: createdUsers[2].id,
          login: createdUsers[2].login,
        },
        {
          addedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+\+\d{2}:\d{2}$/),
          userId: createdUsers[1].id,
          login: createdUsers[1].login,
        },
        {
          addedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+\+\d{2}:\d{2}$/),
          userId: createdUsers[0].id,
          login: createdUsers[0].login,
        },
      ],
    });

    // 🔻 Для первых трёх пользователей получаем пост с авторизацией
    // 🔻 Проверяем, что лайков 3, myStatus Like, newestLikes с тремя пользователями
    for (let i = 0; i < resultLogin.length - 1; i++) {
      const foundPost: PostViewDto = await postsTestManager.getPostById(
        createdPost.id,
        resultLogin[i].authTokens.accessToken,
      );

      expect(foundPost.extendedLikesInfo).toEqual({
        likesCount: 3,
        dislikesCount: 0,
        myStatus: ReactionStatus.Like,
        newestLikes: [
          {
            addedAt: expect.stringMatching(
              /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+\+\d{2}:\d{2}$/,
            ),
            userId: createdUsers[2].id,
            login: createdUsers[2].login,
          },
          {
            addedAt: expect.stringMatching(
              /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+\+\d{2}:\d{2}$/,
            ),
            userId: createdUsers[1].id,
            login: createdUsers[1].login,
          },
          {
            addedAt: expect.stringMatching(
              /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+\+\d{2}:\d{2}$/,
            ),
            userId: createdUsers[0].id,
            login: createdUsers[0].login,
          },
        ],
      });
    }

    // 🔻 Четвёртый пользователь ставит лайк
    const resUpdateReaction_2: Response = await request(server)
      .put(`/${GLOBAL_PREFIX}/posts/${createdPost.id}/like-status`)
      .set('Authorization', `Bearer ${resultLogin[3].authTokens.accessToken}`)
      .send({ likeStatus: ReactionStatus.Like })
      .expect(HttpStatus.NO_CONTENT);

    // 🔻 Получаем пост с авторизацией четвёртого пользователя
    // 🔻 Проверяем, что лайков 4, myStatus Like, newestLikes с тремя пользователями (четвёртый пользователь — первый в списке)
    const foundPost: PostViewDto = await postsTestManager.getPostById(
      createdPost.id,
      resultLogin[3].authTokens.accessToken,
    );

    expect(foundPost.extendedLikesInfo).toEqual({
      likesCount: 4,
      dislikesCount: 0,
      myStatus: ReactionStatus.Like,
      newestLikes: [
        {
          addedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+\+\d{2}:\d{2}$/),
          userId: createdUsers[3].id,
          login: createdUsers[3].login,
        },
        {
          addedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+\+\d{2}:\d{2}$/),
          userId: createdUsers[2].id,
          login: createdUsers[2].login,
        },
        {
          addedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+\+\d{2}:\d{2}$/),
          userId: createdUsers[1].id,
          login: createdUsers[1].login,
        },
      ],
    });

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resUpdateReaction_2.body,
        resUpdateReaction_2.statusCode,
        'Test №4: PostsController - updateReaction() (PUT: /posts/:postId/like-status)',
      );
    }
  });

  it('should update the user\'s "dislike" reaction and increase the number of similar reactions(№1).', async () => {
    // 🔻 Создаём блог
    const [createdBlog]: BlogViewDto[] = await blogsTestManager.createBlog(1);
    // 🔻 Создаём пост в этом блоге
    const [createdPost]: PostViewDto[] = await postsTestManager.createPost(1, createdBlog.id);
    // 🔻 Создаём пользователя
    const [createdUser]: UserViewDto[] = await usersTestManager.createUser(1);
    // 🔻 Логинимся под этим пользователем и получаем токены авторизации
    const [resultLogin]: TestResultLogin[] = await usersTestManager.login([createdUser.login]);

    // 🔻 Отправляем PUT-запрос на установку реакции "Dislike" для поста
    // 🔻 Ожидаем 204 No Content, так как реакция корректно обновлена
    const resUpdateReaction: Response = await request(server)
      .put(`/${GLOBAL_PREFIX}/posts/${createdPost.id}/like-status`)
      .set('Authorization', `Bearer ${resultLogin.authTokens.accessToken}`)
      .send({ likeStatus: ReactionStatus.Dislike })
      .expect(HttpStatus.NO_CONTENT);

    // 🔻 Получаем пост без авторизации
    // 🔻 Проверяем, что dislike увеличился, лайков 0, и myStatus равен None
    const foundPost_1: PostViewDto = await postsTestManager.getPostById(createdPost.id);

    expect(foundPost_1.extendedLikesInfo).toEqual({
      likesCount: 0,
      dislikesCount: 1,
      myStatus: ReactionStatus.None,
      newestLikes: [],
    });

    // 🔻 Получаем пост с авторизацией пользователя, поставившего дизлайк
    // 🔻 Проверяем, что myStatus = Dislike и количество дизлайков корректно
    const foundPost_2: PostViewDto = await postsTestManager.getPostById(
      createdPost.id,
      resultLogin.authTokens.accessToken,
    );

    expect(foundPost_2.extendedLikesInfo).toEqual({
      likesCount: 0,
      dislikesCount: 1,
      myStatus: ReactionStatus.Dislike,
      newestLikes: [],
    });

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resUpdateReaction.body,
        resUpdateReaction.statusCode,
        'Test №5: PostsController - updateReaction() (PUT: /posts/:postId/like-status)',
      );
    }
  });

  it('should update the user\'s "dislike" reaction and increase the number of similar reactions(№2).', async () => {
    // 🔻 Создаём блог
    const [createdBlog]: BlogViewDto[] = await blogsTestManager.createBlog(1);
    // 🔻 Создаём пост в этом блоге
    const [createdPost]: PostViewDto[] = await postsTestManager.createPost(1, createdBlog.id);
    // 🔻 Создаём двух пользователей
    const createdUsers: UserViewDto[] = await usersTestManager.createUser(2);
    // 🔻 Логинимся под обоими пользователями
    const resultLogin: TestResultLogin[] = await usersTestManager.login(
      createdUsers.map((u) => u.login),
    );

    // 🔻 Каждый пользователь отправляет PUT-запрос на установку реакции "Dislike"
    const resUpdateReaction: Response[] = [];

    for (let i = 0; i < resultLogin.length; i++) {
      const res: Response = await request(server)
        .put(`/${GLOBAL_PREFIX}/posts/${createdPost.id}/like-status`)
        .set('Authorization', `Bearer ${resultLogin[i].authTokens.accessToken}`)
        .send({ likeStatus: ReactionStatus.Dislike })
        .expect(HttpStatus.NO_CONTENT);

      resUpdateReaction.push(res);
    }

    // 🔻 Получаем пост без авторизации
    // 🔻 Проверяем, что dislikesCount = 2, likesCount = 0, myStatus = None
    const foundPost_1: PostViewDto = await postsTestManager.getPostById(createdPost.id);

    expect(foundPost_1.extendedLikesInfo).toEqual({
      likesCount: 0,
      dislikesCount: 2,
      myStatus: ReactionStatus.None,
      newestLikes: [],
    });

    // 🔻 Для каждого пользователя получаем пост с авторизацией
    // 🔻 Проверяем, что myStatus = Dislike и dislikesCount = 2
    for (let i = 0; i < resultLogin.length; i++) {
      const foundPost: PostViewDto = await postsTestManager.getPostById(
        createdPost.id,
        resultLogin[i].authTokens.accessToken,
      );

      expect(foundPost.extendedLikesInfo).toEqual({
        likesCount: 0,
        dislikesCount: 2,
        myStatus: ReactionStatus.Dislike,
        newestLikes: [],
      });
    }

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resUpdateReaction[0].body,
        resUpdateReaction[0].statusCode,
        'Test №6: PostsController - updateReaction() (PUT: /posts/:postId/like-status)',
      );
    }
  });

  it('should update "None" to "Like", "Like" to "Dislike", "Dislike to "Like", "Like" to "None".', async () => {
    // 🔻 Создаём блог
    const [createdBlog]: BlogViewDto[] = await blogsTestManager.createBlog(1);
    // 🔻 Создаём пост в этом блоге
    const [createdPost]: PostViewDto[] = await postsTestManager.createPost(1, createdBlog.id);
    // 🔻 Создаём пользователя
    const [createdUser]: UserViewDto[] = await usersTestManager.createUser(1);
    // 🔻 Логинимся под этим пользователем и получаем токены авторизации
    const [resultLogin]: TestResultLogin[] = await usersTestManager.login([createdUser.login]);

    // 🔻 Обновляем реакцию с None на Like
    const resUpdateReaction: Response = await request(server)
      .put(`/${GLOBAL_PREFIX}/posts/${createdPost.id}/like-status`)
      .set('Authorization', `Bearer ${resultLogin.authTokens.accessToken}`)
      .send({ likeStatus: ReactionStatus.Like })
      .expect(HttpStatus.NO_CONTENT);

    // 🔻 Получаем пост с авторизацией, проверяем правильность изменений
    const foundPost_1: PostViewDto = await postsTestManager.getPostById(
      createdPost.id,
      resultLogin.authTokens.accessToken,
    );

    expect(foundPost_1.extendedLikesInfo).toEqual({
      likesCount: 1,
      dislikesCount: 0,
      myStatus: ReactionStatus.Like,
      newestLikes: [
        {
          addedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+\+\d{2}:\d{2}$/),
          userId: createdUser.id,
          login: createdUser.login,
        },
      ],
    });

    // 🔻 Обновляем реакцию с Like на Dislike
    await request(server)
      .put(`/${GLOBAL_PREFIX}/posts/${createdPost.id}/like-status`)
      .set('Authorization', `Bearer ${resultLogin.authTokens.accessToken}`)
      .send({ likeStatus: ReactionStatus.Dislike })
      .expect(HttpStatus.NO_CONTENT);

    const foundPost_2: PostViewDto = await postsTestManager.getPostById(
      createdPost.id,
      resultLogin.authTokens.accessToken,
    );

    expect(foundPost_2.extendedLikesInfo).toEqual({
      likesCount: 0,
      dislikesCount: 1,
      myStatus: ReactionStatus.Dislike,
      newestLikes: [],
    });

    // 🔻 Обновляем реакцию с Dislike обратно на Like
    await request(server)
      .put(`/${GLOBAL_PREFIX}/posts/${createdPost.id}/like-status`)
      .set('Authorization', `Bearer ${resultLogin.authTokens.accessToken}`)
      .send({ likeStatus: ReactionStatus.Like })
      .expect(HttpStatus.NO_CONTENT);

    const foundPost_3: PostViewDto = await postsTestManager.getPostById(
      createdPost.id,
      resultLogin.authTokens.accessToken,
    );

    expect(foundPost_3.extendedLikesInfo).toEqual({
      likesCount: 1,
      dislikesCount: 0,
      myStatus: ReactionStatus.Like,
      newestLikes: [
        {
          addedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+\+\d{2}:\d{2}$/),
          userId: createdUser.id,
          login: createdUser.login,
        },
      ],
    });

    // 🔻 Обновляем реакцию с Like на None (удаление реакции)
    await request(server)
      .put(`/${GLOBAL_PREFIX}/posts/${createdPost.id}/like-status`)
      .set('Authorization', `Bearer ${resultLogin.authTokens.accessToken}`)
      .send({ likeStatus: ReactionStatus.None })
      .expect(HttpStatus.NO_CONTENT);

    const foundPost_4: PostViewDto = await postsTestManager.getPostById(
      createdPost.id,
      resultLogin.authTokens.accessToken,
    );

    expect(foundPost_4.extendedLikesInfo).toEqual({
      likesCount: 0,
      dislikesCount: 0,
      myStatus: ReactionStatus.None,
      newestLikes: [],
    });

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resUpdateReaction.body,
        resUpdateReaction.statusCode,
        'Test №7: PostsController - updateReaction() (PUT: /posts/:postId/like-status)',
      );
    }
  });

  it('1. The first five posts: user 1 - puts likes; user 2 - puts dislikes. 2. The following five posts: user 1 - dislikes; user 2 - likes.', async () => {
    // 🔻 Создаём блог
    const [createdBlog]: BlogViewDto[] = await blogsTestManager.createBlog(1);
    // 🔻 Создаём 10 постов внутри блога
    const createdPosts: PostViewDto[] = await postsTestManager.createPost(10, createdBlog.id);
    // 🔻 Создаём двух пользователей
    const [createUser1, createUser2]: UserViewDto[] = await usersTestManager.createUser(2);
    // 🔻 Логинимся обоими пользователями, получаем токены авторизации
    const resultLogins: TestResultLogin[] = await usersTestManager.login([
      createUser1.login,
      createUser2.login,
    ]);

    // 🔻 Для первых пяти постов: user 1 ставит лайки, user 2 — дизлайки
    // 🔻 Для следующих пяти постов: user 1 ставит дизлайки, user 2 — лайки
    for (let i = 0; i < createdPosts.length; i++) {
      if (createdPosts.length / 2 > i) {
        // user 1 - ставит лайк
        await request(server)
          .put(`/${GLOBAL_PREFIX}/posts/${createdPosts[i].id}/like-status`)
          .set('Authorization', `Bearer ${resultLogins[0].authTokens.accessToken}`)
          .send({ likeStatus: ReactionStatus.Like })
          .expect(HttpStatus.NO_CONTENT);

        // user 2 - ставит дизлайк
        await request(server)
          .put(`/${GLOBAL_PREFIX}/posts/${createdPosts[i].id}/like-status`)
          .set('Authorization', `Bearer ${resultLogins[1].authTokens.accessToken}`)
          .send({ likeStatus: ReactionStatus.Dislike })
          .expect(HttpStatus.NO_CONTENT);
      } else {
        // user 1 - ставит дизлайк
        await request(server)
          .put(`/${GLOBAL_PREFIX}/posts/${createdPosts[i].id}/like-status`)
          .set('Authorization', `Bearer ${resultLogins[0].authTokens.accessToken}`)
          .send({ likeStatus: ReactionStatus.Dislike })
          .expect(HttpStatus.NO_CONTENT);

        // user 2 - ставит лайк
        await request(server)
          .put(`/${GLOBAL_PREFIX}/posts/${createdPosts[i].id}/like-status`)
          .set('Authorization', `Bearer ${resultLogins[1].authTokens.accessToken}`)
          .send({ likeStatus: ReactionStatus.Like })
          .expect(HttpStatus.NO_CONTENT);
      }
    }

    // 🔻 Получаем все посты с авторизацией user 1
    const foundPosts_1: PaginatedViewDto<PostViewDto> = await postsTestManager.getAllPosts(
      {},
      resultLogins[0].authTokens.accessToken,
    );

    // 🔻 Сортируем все посты по возрастанию
    const query: GetPostsQueryParams = new GetPostsQueryParams();
    query.sortDirection = SortDirection.Ascending;
    const sortedPosts: PostViewDto[] = new Filter<PostViewDto>(foundPosts_1.items)
      .sort({ [query.sortBy]: query.sortDirection })
      .getResult();

    // 🔻 Проверяем лайки и дизлайки и myStatus для user 1
    for (let i = 0; i < sortedPosts.length; i++) {
      if (sortedPosts.length / 2 > i) {
        expect(sortedPosts[i].extendedLikesInfo).toEqual({
          likesCount: 1,
          dislikesCount: 1,
          myStatus: ReactionStatus.Like,
          newestLikes: [
            {
              addedAt: expect.stringMatching(
                /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+\+\d{2}:\d{2}$/,
              ),
              userId: createUser1.id,
              login: createUser1.login,
            },
          ],
        });
      } else {
        expect(sortedPosts[i].extendedLikesInfo).toEqual({
          likesCount: 1,
          dislikesCount: 1,
          myStatus: ReactionStatus.Dislike,
          newestLikes: [
            {
              addedAt: expect.stringMatching(
                /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+\+\d{2}:\d{2}$/,
              ),
              userId: createUser2.id,
              login: createUser2.login,
            },
          ],
        });
      }
    }

    // 🔻 Получаем все посты с авторизацией user 2
    const foundPosts_2: PaginatedViewDto<PostViewDto> = await postsTestManager.getAllPosts(
      {},
      resultLogins[1].authTokens.accessToken,
    );

    // 🔻 Сортируем по возрастанию
    query.sortDirection = SortDirection.Ascending;
    const sortedPosts_2: PostViewDto[] = new Filter<PostViewDto>(foundPosts_2.items)
      .sort({ [query.sortBy]: query.sortDirection })
      .getResult();

    // 🔻 Проверяем лайки, дизлайки и myStatus для user 2
    for (let i = 0; i < sortedPosts_2.length; i++) {
      if (sortedPosts_2.length / 2 > i) {
        expect(sortedPosts_2[i].extendedLikesInfo).toEqual({
          likesCount: 1,
          dislikesCount: 1,
          myStatus: ReactionStatus.Dislike,
          newestLikes: [
            {
              addedAt: expect.stringMatching(
                /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+\+\d{2}:\d{2}$/,
              ),
              userId: createUser1.id,
              login: createUser1.login,
            },
          ],
        });
      } else {
        expect(sortedPosts_2[i].extendedLikesInfo).toEqual({
          likesCount: 1,
          dislikesCount: 1,
          myStatus: ReactionStatus.Like,
          newestLikes: [
            {
              addedAt: expect.stringMatching(
                /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+\+\d{2}:\d{2}$/,
              ),
              userId: createUser2.id,
              login: createUser2.login,
            },
          ],
        });
      }
    }

    // 🔻 Получаем все посты без авторизации
    const foundPosts_3: PaginatedViewDto<PostViewDto> = await postsTestManager.getAllPosts();

    // 🔻 Сортируем по возрастанию
    query.sortDirection = SortDirection.Ascending;
    const sortedPosts_3: PostViewDto[] = new Filter<PostViewDto>(foundPosts_3.items)
      .sort({ [query.sortBy]: query.sortDirection })
      .getResult();

    // 🔻 Проверяем, что myStatus у всех постов None, лайки и дизлайки подсчитаны корректно
    for (let i = 0; i < sortedPosts_3.length; i++) {
      if (sortedPosts_3.length / 2 > i) {
        expect(sortedPosts_3[i].extendedLikesInfo).toEqual({
          likesCount: 1,
          dislikesCount: 1,
          myStatus: ReactionStatus.None,
          newestLikes: [
            {
              addedAt: expect.stringMatching(
                /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+\+\d{2}:\d{2}$/,
              ),
              userId: createUser1.id,
              login: createUser1.login,
            },
          ],
        });
      } else {
        expect(sortedPosts_3[i].extendedLikesInfo).toEqual({
          likesCount: 1,
          dislikesCount: 1,
          myStatus: ReactionStatus.None,
          newestLikes: [
            {
              addedAt: expect.stringMatching(
                /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+\+\d{2}:\d{2}$/,
              ),
              userId: createUser2.id,
              login: createUser2.login,
            },
          ],
        });
      }
    }

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        {},
        HttpStatus.NO_CONTENT,
        'Test №8: PostsController - updateReaction() (PUT: /posts/:postId/like-status)',
      );
    }
  });

  it('1. must create ten users. 2. All ten users like one post. 3.Then each user changes the like to dislike reaction. newestLikes should change along with this.', async () => {
    // 🔻 Создаём блог
    const [createdBlog]: BlogViewDto[] = await blogsTestManager.createBlog(1);
    // 🔻 Создаём один пост внутри блога
    const [createdPost]: PostViewDto[] = await postsTestManager.createPost(1, createdBlog.id);
    // 🔻 Создаём десять пользователей
    const createdUsers: UserViewDto[] = await usersTestManager.createUser(10);
    // 🔻 Логинимся под всеми пользователями; при 5-м пользователе очищаем throttler
    const resultLogins: TestResultLogin[] = await usersTestManager.login(
      createdUsers.map((user: UserViewDto, index: number): string => {
        if (index === 5) appTestManager.clearThrottlerStorage();
        return user.login;
      }),
    );

    // 🔻 Все десять пользователей ставят лайк одному посту
    for (let i = 0; i < resultLogins.length; i++) {
      await request(server)
        .put(`/${GLOBAL_PREFIX}/posts/${createdPost.id}/like-status`)
        .set('Authorization', `Bearer ${resultLogins[i].authTokens.accessToken}`)
        .send({ likeStatus: ReactionStatus.Like })
        .expect(HttpStatus.NO_CONTENT);
    }

    // 🔻 Получаем пост без авторизации и проверяем количество лайков (10), дизлайков (0) и список новых лайков (3 последних)
    const foundPost: PostViewDto = await postsTestManager.getPostById(createdPost.id);

    expect(foundPost.extendedLikesInfo).toEqual({
      likesCount: 10,
      dislikesCount: 0,
      myStatus: ReactionStatus.None,
      newestLikes: [
        {
          addedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+\+\d{2}:\d{2}$/),
          userId: createdUsers[9].id,
          login: createdUsers[9].login,
        },
        {
          addedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+\+\d{2}:\d{2}$/),
          userId: createdUsers[8].id,
          login: createdUsers[8].login,
        },
        {
          addedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+\+\d{2}:\d{2}$/),
          userId: createdUsers[7].id,
          login: createdUsers[7].login,
        },
      ],
    });

    // 🔻 В обратном порядке каждый пользователь меняет лайк на дизлайк, и после каждого изменения проверяет состояние
    for (let i = resultLogins.length - 1; i >= 0; i--) {
      await request(server)
        .put(`/${GLOBAL_PREFIX}/posts/${createdPost.id}/like-status`)
        .set('Authorization', `Bearer ${resultLogins[i].authTokens.accessToken}`)
        .send({ likeStatus: ReactionStatus.Dislike })
        .expect(HttpStatus.NO_CONTENT);

      const foundPost: PostViewDto = await postsTestManager.getPostById(
        createdPost.id,
        resultLogins[i].authTokens.accessToken,
      );

      const dislikesCount: number = resultLogins.length - i;

      expect(foundPost.extendedLikesInfo).toEqual({
        likesCount: 10 - dislikesCount,
        dislikesCount,
        myStatus: ReactionStatus.Dislike,
        newestLikes: (() => {
          if (i >= 3) {
            return [
              {
                addedAt: expect.stringMatching(
                  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+\+\d{2}:\d{2}$/,
                ),
                userId: createdUsers[i - 1].id,
                login: createdUsers[i - 1].login,
              },
              {
                addedAt: expect.stringMatching(
                  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+\+\d{2}:\d{2}$/,
                ),
                userId: createdUsers[i - 2].id,
                login: createdUsers[i - 2].login,
              },
              {
                addedAt: expect.stringMatching(
                  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+\+\d{2}:\d{2}$/,
                ),
                userId: createdUsers[i - 3].id,
                login: createdUsers[i - 3].login,
              },
            ];
          }

          if (i === 2) {
            return [
              {
                addedAt: expect.stringMatching(
                  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+\+\d{2}:\d{2}$/,
                ),
                userId: createdUsers[i - 1].id,
                login: createdUsers[i - 1].login,
              },
              {
                addedAt: expect.stringMatching(
                  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+\+\d{2}:\d{2}$/,
                ),
                userId: createdUsers[i - 2].id,
                login: createdUsers[i - 2].login,
              },
            ];
          }

          if (i === 1) {
            return [
              {
                addedAt: expect.stringMatching(
                  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+\+\d{2}:\d{2}$/,
                ),
                userId: createdUsers[i - 1].id,
                login: createdUsers[i - 1].login,
              },
            ];
          }

          return [];
        })(),
      });
    }

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        {},
        HttpStatus.NO_CONTENT,
        'Test №9: PostsController - updateReaction() (PUT: /posts/:postId/like-status)',
      );
    }
  });

  it('should return a 401 if the user is not logged in.', async () => {
    // 🔻 Создаём блог
    const [createdBlog]: BlogViewDto[] = await blogsTestManager.createBlog(1);
    // 🔻 Создаём пост в этом блоге
    const [createdPost]: PostViewDto[] = await postsTestManager.createPost(1, createdBlog.id);

    // 🔻 Отправляем PUT-запрос с некорректным/незалогиненным токеном
    // 🔻 Ожидаем 401 Unauthorized
    const resUpdateReaction: Response = await request(server)
      .put(`/${GLOBAL_PREFIX}/posts/${createdPost.id}/like-status`)
      .set('Authorization', `Bearer incorrect token`)
      .send({ likeStatus: ReactionStatus.Like })
      .expect(HttpStatus.UNAUTHORIZED);

    // 🔻 Получаем пост и проверяем, что реакций нет и myStatus None
    const foundPost: PostViewDto = await postsTestManager.getPostById(createdPost.id);

    expect(foundPost.extendedLikesInfo).toEqual({
      likesCount: 0,
      dislikesCount: 0,
      myStatus: ReactionStatus.None,
      newestLikes: [],
    });

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resUpdateReaction.body,
        resUpdateReaction.statusCode,
        'Test №10: PostsController - updateReaction() (PUT: /posts/:postId/like-status)',
      );
    }
  });

  it('should return the value 404 if the post the user is trying to review does not exist.', async () => {
    // 🔻 Создаём пользователя
    const [createdUser]: UserViewDto[] = await usersTestManager.createUser(1);
    // 🔻 Логинимся под этим пользователем
    const [resultLogin]: TestResultLogin[] = await usersTestManager.login([createdUser.login]);
    // 🔻 Используем несуществующий ID поста
    const incorrectPostId: string = '1000000';

    // 🔻 Отправляем PUT-запрос на несуществующий пост
    // 🔻 Ожидаем 404 Not Found
    const resUpdateReaction: Response = await request(server)
      .put(`/${GLOBAL_PREFIX}/posts/${incorrectPostId}/like-status`)
      .set('Authorization', `Bearer ${resultLogin.authTokens.accessToken}`)
      .send({ likeStatus: ReactionStatus.Like })
      .expect(HttpStatus.NOT_FOUND);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resUpdateReaction.body,
        resUpdateReaction.statusCode,
        'Test №11: PostsController - updateReaction() (PUT: /posts/:postId/like-status)',
      );
    }
  });

  it('should return 400 if the input data is not valid (an empty object is passed).', async () => {
    // 🔻 Создаём блог
    const [createdBlog]: BlogViewDto[] = await blogsTestManager.createBlog(1);
    // 🔻 Создаём пост в этом блоге
    const [createdPost]: PostViewDto[] = await postsTestManager.createPost(1, createdBlog.id);
    // 🔻 Создаём пользователя
    const [createdUser]: UserViewDto[] = await usersTestManager.createUser(1);
    // 🔻 Логинимся под этим пользователем и получаем токены авторизации
    const [resultLogin]: TestResultLogin[] = await usersTestManager.login([createdUser.login]);

    // 🔻 Отправляем PUT-запрос с пустым объектом (некорректные данные)
    // 🔻 Ожидаем 400 Bad Request с сообщением об ошибках валидации
    const resUpdateReaction: Response = await request(server)
      .put(`/${GLOBAL_PREFIX}/posts/${createdPost.id}/like-status`)
      .set('Authorization', `Bearer ${resultLogin.authTokens.accessToken}`)
      .send({})
      .expect(HttpStatus.BAD_REQUEST);

    expect(resUpdateReaction.body).toEqual({
      errorsMessages: [
        {
          field: 'likeStatus',
          message:
            'likeStatus must be one of the following values: None, Like, Dislike; Received value: undefined',
        },
      ],
    });

    // 🔻 Получаем пост и проверяем, что реакции не появились и myStatus равен None
    const foundPost: PostViewDto = await postsTestManager.getPostById(createdPost.id);

    expect(foundPost.extendedLikesInfo).toEqual({
      likesCount: 0,
      dislikesCount: 0,
      myStatus: ReactionStatus.None,
      newestLikes: [],
    });

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resUpdateReaction.body,
        resUpdateReaction.statusCode,
        'Test №12: PostsController - updateReaction() (PUT: /posts/:postId/like-status)',
      );
    }
  });

  it('should return 400 if the input data is not valid (likeStatus differs from other values).', async () => {
    // 🔻 Создаём блог
    const [createdBlog]: BlogViewDto[] = await blogsTestManager.createBlog(1);
    // 🔻 Создаём пост в этом блоге
    const [createdPost]: PostViewDto[] = await postsTestManager.createPost(1, createdBlog.id);
    // 🔻 Создаём пользователя
    const [createdUser]: UserViewDto[] = await usersTestManager.createUser(1);
    // 🔻 Логинимся под этим пользователем и получаем токены авторизации
    const [resultLogin]: TestResultLogin[] = await usersTestManager.login([createdUser.login]);

    // 🔻 Отправляем PUT-запрос с некорректным значением likeStatus
    // 🔻 Ожидаем 400 Bad Request с сообщением об ошибке валидации
    const resUpdateReaction: Response = await request(server)
      .put(`/${GLOBAL_PREFIX}/posts/${createdPost.id}/like-status`)
      .set('Authorization', `Bearer ${resultLogin.authTokens.accessToken}`)
      .send({ likeStatus: 'Likes' })
      .expect(HttpStatus.BAD_REQUEST);

    expect(resUpdateReaction.body).toEqual({
      errorsMessages: [
        {
          field: 'likeStatus',
          message:
            'likeStatus must be one of the following values: None, Like, Dislike; Received value: Likes',
        },
      ],
    });

    // 🔻 Получаем пост и проверяем отсутствие реакций и myStatus = None
    const foundPost: PostViewDto = await postsTestManager.getPostById(createdPost.id);

    expect(foundPost.extendedLikesInfo).toEqual({
      likesCount: 0,
      dislikesCount: 0,
      myStatus: ReactionStatus.None,
      newestLikes: [],
    });

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resUpdateReaction.body,
        resUpdateReaction.statusCode,
        'Test №13: PostsController - updateReaction() (PUT: /posts/:postId/like-status)',
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
    // 🔻 Логинимся под этим пользователем и получаем токены
    const [resultLogin]: TestResultLogin[] = await usersTestManager.login([createdUser.login]);

    // 🔻 Ждём 3 секунды (для истечения срока действия токена, например)
    await TestUtils.delay(3000);

    // 🔻 Отправляем PUT-запрос с устаревшим или недействительным токеном
    // 🔻 Ожидаем 401 Unauthorized
    const resUpdateReaction: Response = await request(server)
      .put(`/${GLOBAL_PREFIX}/posts/${createdPost.id}/like-status`)
      .set('Authorization', `Bearer ${resultLogin.authTokens.accessToken}`)
      .send({ likeStatus: ReactionStatus.Like })
      .expect(HttpStatus.UNAUTHORIZED);

    // 🔻 Получаем пост и проверяем, что реакций нет и myStatus None
    const foundPost_1: PostViewDto = await postsTestManager.getPostById(createdPost.id);

    expect(foundPost_1.extendedLikesInfo).toEqual({
      likesCount: 0,
      dislikesCount: 0,
      myStatus: ReactionStatus.None,
      newestLikes: [],
    });

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resUpdateReaction.body,
        resUpdateReaction.statusCode,
        'Test №14: PostsController - updateReaction() (PUT: /posts/:postId/like-status)',
      );
    }
  });
});
