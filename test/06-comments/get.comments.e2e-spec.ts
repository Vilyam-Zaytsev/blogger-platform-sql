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
import { PostViewDto } from '../../src/modules/bloggers-platform/posts/api/view-dto/post-view.dto';
import { PostsTestManager } from '../managers/posts.test-manager';
import { UsersTestManager } from '../managers/users.test-manager';
import { CommentsTestManager } from '../managers/comments.test-manager';
import { CommentViewDto } from '../../src/modules/bloggers-platform/comments/api/view-dto/comment-view.dto';
import { PaginatedViewDto } from '../../src/core/dto/paginated.view-dto';
import { Filter } from '../helpers/filter';
import { GetCommentsQueryParams } from '../../src/modules/bloggers-platform/comments/api/input-dto/get-comments-query-params.input-dto';
import { UserViewDto } from '../../src/modules/user-accounts/users/api/view-dto/user.view-dto';
import { ReactionStatus } from '../../src/modules/bloggers-platform/reactions/types/reaction-db.type';

describe('PostsController - getComments() (GET: /posts/{postId}/comments)', () => {
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

  it('should return an empty array.', async () => {
    // 🔻 Создаём блог
    const [createdBlog]: BlogViewDto[] = await blogsTestManager.createBlog(1);
    // 🔻 Создаём пост в этом блоге
    const [createdPost]: PostViewDto[] = await postsTestManager.createPost(1, createdBlog.id);

    // 🔻 Отправляем GET-запрос на получение комментариев к посту
    // 🔻 Ожидаем 200 OK и пустой список комментариев, так как комментарии ещё не создавались
    const resGetComments: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/posts/${createdPost.id}/comments`)
      .expect(HttpStatus.OK);

    // 🔻 Проверяем, что в ответе пустой массив items и все параметры пагинации равны нулю, кроме page и pageSize
    expect(resGetComments.body).toEqual({
      pagesCount: 0,
      page: 1,
      pageSize: 10,
      totalCount: 0,
      items: [],
    });

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resGetComments.body,
        resGetComments.statusCode,
        'Test №1: PostsController - getComments() (GET: /posts/{postId}/comments)',
      );
    }
  });

  it('should return an array with a single comment.', async () => {
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

    // 🔻 Отправляем GET-запрос на получение комментариев к посту
    // 🔻 Ожидаем 200 OK и массив с одним комментарием
    const resGetComments: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/posts/${createdPost.id}/comments`)
      .expect(HttpStatus.OK);

    // 🔻 Проверяем, что ответ содержит корректные параметры пагинации и данные созданного комментария
    expect(resGetComments.body).toEqual({
      pagesCount: 1,
      page: 1,
      pageSize: 10,
      totalCount: 1,
      items: [
        {
          id: createdComment.id,
          content: createdComment.content,
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
        },
      ],
    });

    // 🔻 Проверяем, что длина массива комментариев равна 1
    expect(resGetComments.body.items.length).toEqual(1);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resGetComments.body,
        resGetComments.statusCode,
        'Test №2: PostsController - getComments() (GET: /posts/{postId}/comments)',
      );
    }
  });

  it('should return an array with three comments.', async () => {
    // 🔻 Создаём блог
    const [createdBlog]: BlogViewDto[] = await blogsTestManager.createBlog(1);
    // 🔻 Создаём пост в этом блоге
    const [createdPost]: PostViewDto[] = await postsTestManager.createPost(1, createdBlog.id);
    // 🔻 Создаём пользователя
    const [createdUser]: UserViewDto[] = await usersTestManager.createUser(1);
    // 🔻 Логинимся под этим пользователем и получаем токены авторизации
    const [resultLogin]: TestResultLogin[] = await usersTestManager.login([createdUser.login]);
    // 🔻 Создаём три комментария к посту от имени авторизованного пользователя
    const createdComments: CommentViewDto[] = await commentsTestManager.createComment(
      3,
      createdPost.id,
      resultLogin.authTokens.accessToken,
    );

    // 🔻 Отправляем GET-запрос на получение комментариев к посту
    // 🔻 Ожидаем 200 OK и массив с тремя комментариями
    const resGetComments: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/posts/${createdPost.id}/comments`)
      .expect(HttpStatus.OK);

    // 🔻 Формируем параметры запроса по умолчанию (сортировка, пагинация)
    const query: GetCommentsQueryParams = new GetCommentsQueryParams();
    // 🔻 Фильтруем, сортируем и ограничиваем список созданных комментариев согласно параметрам запроса
    const filteredCreatedComments: CommentViewDto[] = new Filter<CommentViewDto>(createdComments)
      .sort({ [query.sortBy]: query.sortDirection })
      .skip(query.calculateSkip())
      .limit(query.pageSize)
      .getResult();

    // 🔻 Проверяем, что комментарии в ответе совпадают с ожидаемыми (по сортировке и пагинации)
    expect(resGetComments.body.items).toEqual(filteredCreatedComments);

    // 🔻 Проверяем, что длина массива комментариев равна 3
    expect(resGetComments.body.items.length).toEqual(3);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resGetComments.body,
        resGetComments.statusCode,
        'Test №3: PostsController - getComments() (GET: /posts/{postId}/comments)',
      );
    }
  });

  it('should return comment found by id.', async () => {
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

    // 🔻 Отправляем GET-запрос на получение комментария по его ID
    // 🔻 Ожидаем 200 OK и данные, идентичные созданному комментарию
    const resGetComment: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/comments/${createdComment.id}`)
      .expect(HttpStatus.OK);

    // 🔻 Проверяем, что в ответе вернулся именно созданный комментарий
    expect(resGetComment.body).toEqual(createdComment);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resGetComment.body,
        resGetComment.statusCode,
        'Test №4: CommentsController - getById() (GET: /comments/:id)',
      );
    }
  });

  it('should return the 404 not found error (if the comment with this ID does not exist).', async () => {
    // 🔻 Создаём блог
    const [createdBlog]: BlogViewDto[] = await blogsTestManager.createBlog(1);
    // 🔻 Создаём пост в этом блоге
    const [createdPost]: PostViewDto[] = await postsTestManager.createPost(1, createdBlog.id);
    // 🔻 Создаём пользователя
    const [createdUser]: UserViewDto[] = await usersTestManager.createUser(1);
    // 🔻 Логинимся под этим пользователем и получаем токены авторизации
    const [resultLogin]: TestResultLogin[] = await usersTestManager.login([createdUser.login]);
    // 🔻 Создаём комментарий к посту от имени авторизованного пользователя
    await commentsTestManager.createComment(1, createdPost.id, resultLogin.authTokens.accessToken);
    // 🔻 Определяем несуществующий ID комментария
    const incorrectCommentId: string = '1000000';

    // 🔻 Отправляем GET-запрос на получение комментария по несуществующему ID
    // 🔻 Ожидаем 404 Not Found, потому что комментарий с таким ID отсутствует в базе
    const resGetComment: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/comments/${incorrectCommentId}`)
      .expect(HttpStatus.NOT_FOUND);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resGetComment.body,
        resGetComment.statusCode,
        'Test №5: CommentsController - getById() (GET: /comments/:id)',
      );
    }
  });

  it('should return the 404 not found error (if the post with this ID does not exist).', async () => {
    // 🔻 Создаём блог
    const [createdBlog]: BlogViewDto[] = await blogsTestManager.createBlog(1);
    // 🔻 Создаём пост в этом блоге
    const [createdPost]: PostViewDto[] = await postsTestManager.createPost(1, createdBlog.id);
    // 🔻 Создаём пользователя
    const [createdUser]: UserViewDto[] = await usersTestManager.createUser(1);
    // 🔻 Логинимся под этим пользователем и получаем токены авторизации
    const [resultLogin]: TestResultLogin[] = await usersTestManager.login([createdUser.login]);
    // 🔻 Создаём комментарий к посту от имени авторизованного пользователя
    await commentsTestManager.createComment(1, createdPost.id, resultLogin.authTokens.accessToken);
    // 🔻 Определяем несуществующий ID поста
    const incorrectPostId: string = '1000000';

    // 🔻 Отправляем GET-запрос на получение комментариев по несуществующему ID поста
    // 🔻 Ожидаем 404 Not Found, потому что пост с таким ID отсутствует в базе
    const resGetComment: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/posts/${incorrectPostId}/comments`)
      .expect(HttpStatus.NOT_FOUND);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resGetComment.body,
        resGetComment.statusCode,
        'Test №6: PostsController - getComments() (GET: /posts/{postId}comments)',
      );
    }
  });
});
