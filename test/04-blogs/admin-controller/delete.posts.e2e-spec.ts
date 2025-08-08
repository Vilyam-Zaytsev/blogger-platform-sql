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
import { PaginatedViewDto } from '../../../src/core/dto/paginated.view-dto';

describe('BlogsAdminController - deletePost() (DELETE: /sa/blogs/:blogId/posts/:postId)', () => {
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

  it('should delete post, the admin is authenticated.', async () => {
    // 🔻 Создаем один блог
    const [createdBlog]: BlogViewDto[] = await blogsTestManager.createBlog(1);

    // 🔻 Создаем один пост, привязанный к блогу
    const [createdPost]: PostViewDto[] = await postsTestManager.createPost(
      1,
      createdBlog.id,
    );

    // 🔻 Отправляем запрос на удаление поста по его ID и ID блога
    const resDeletePost: Response = await request(server)
      .delete(
        `/${GLOBAL_PREFIX}/sa/blogs/${createdBlog.id}/posts/${createdPost.id}`,
      )
      .set('Authorization', adminCredentialsInBase64) // 🔸 Авторизация администратора присутствует
      .expect(HttpStatus.NO_CONTENT); // 🔸 Ожидаем статус 204 No Content (успешное удаление без тела ответа)

    // 🔻 Получаем список всех постов после удаления
    const posts: PaginatedViewDto<PostViewDto> =
      await postsTestManager.getAllPosts();

    // 🔸 Убеждаемся, что постов больше нет
    expect(posts.items).toHaveLength(0);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resDeletePost.body,
        resDeletePost.statusCode,
        'Test №1: BlogsAdminController - deletePost() (DELETE: /sa/blogs/:blogId/posts/:postId)',
      );
    }
  });

  it('should not delete blog, the admin is not authenticated.', async () => {
    // 🔻 Создаем один блог
    const [createdBlog]: BlogViewDto[] = await blogsTestManager.createBlog(1);

    // 🔻 Создаем один пост, привязанный к блогу
    const [createdPost]: PostViewDto[] = await postsTestManager.createPost(
      1,
      createdBlog.id,
    );

    // 🔻 Пытаемся удалить пост с некорректными данными авторизации
    const resDeletePost: Response = await request(server)
      .delete(
        `/${GLOBAL_PREFIX}/sa/blogs/${createdBlog.id}/posts/${createdPost.id}`,
      )
      .set('Authorization', 'incorrect admin credentials') // 🔸 Подставлены неверные данные авторизации
      .expect(HttpStatus.UNAUTHORIZED); // 🔸 Ожидаем статус 401 Unauthorized

    // 🔻 Получаем пост по его ID, чтобы убедиться, что он не был удален
    const post: PostViewDto = await postsTestManager.getPostById(
      createdPost.id,
    );

    // 🔸 Проверяем, что полученный пост совпадает с исходным (удаление не произошло)
    expect(post).toEqual(createdPost);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resDeletePost.body,
        resDeletePost.statusCode,
        'Test №2: BlogsAdminController - deletePost() (DELETE: /sa/blogs/:blogId/posts/:postId)',
      );
    }
  });

  it('should return a 404 error if the blog was not found by the passed ID in the parameters.', async () => {
    // 🔻 Создаем один блог
    const [createdBlog]: BlogViewDto[] = await blogsTestManager.createBlog(1);

    // 🔻 Создаем один пост, привязанный к созданному блогу
    const [createdPost]: PostViewDto[] = await postsTestManager.createPost(
      1,
      createdBlog.id,
    );

    // 🔻 Подготавливаем несуществующий blogId
    const incorrectBlogId: string = '1000000';

    // 🔻 Пытаемся удалить пост, указав несуществующий blogId
    const resDeletePost: Response = await request(server)
      .delete(
        `/${GLOBAL_PREFIX}/sa/blogs/${incorrectBlogId}/posts/${createdPost.id}`,
      )
      .set('Authorization', adminCredentialsInBase64) // 🔸 Передаём валидную авторизацию
      .expect(HttpStatus.NOT_FOUND); // 🔸 Ожидаем статус 404 Not Found

    // 🔻 Получаем пост по ID, чтобы убедиться, что он всё ещё существует
    const post: PostViewDto = await postsTestManager.getPostById(
      createdPost.id,
    );

    // 🔸 Проверяем, что пост остался в базе и не был удалён
    expect(post).toEqual(createdPost);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resDeletePost.body,
        resDeletePost.statusCode,
        'Test №3: BlogsAdminController - deletePost() (DELETE: /sa/blogs/:blogId/posts/:postId)',
      );
    }
  });

  it('should return a 404 error if the post was not found by the passed identifier in the parameters.', async () => {
    // 🔻 Создаем один блог
    const [createdBlog]: BlogViewDto[] = await blogsTestManager.createBlog(1);

    // 🔻 Создаем один пост, привязанный к созданному блогу
    const [createdPost]: PostViewDto[] = await postsTestManager.createPost(
      1,
      createdBlog.id,
    );

    // 🔻 Подготавливаем несуществующий postId
    const incorrectPostId: string = '1000000';

    // 🔻 Пытаемся удалить пост по несуществующему postId
    const resDeletePost: Response = await request(server)
      .delete(
        `/${GLOBAL_PREFIX}/sa/blogs/${createdBlog.id}/posts/${incorrectPostId}`,
      )
      .set('Authorization', adminCredentialsInBase64) // 🔸 Передаём валидную авторизацию
      .expect(HttpStatus.NOT_FOUND); // 🔸 Ожидаем статус 404 Not Found

    // 🔻 Получаем пост по его корректному ID, чтобы убедиться, что он остался в базе
    const post: PostViewDto = await postsTestManager.getPostById(
      createdPost.id,
    );

    // 🔸 Проверяем, что пост не был удалён
    expect(post).toEqual(createdPost);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resDeletePost.body,
        resDeletePost.statusCode,
        'Test №4: BlogsAdminController - deletePost() (DELETE: /sa/blogs/:blogId/posts/:postId)',
      );
    }
  });

  it('should return a 403 error if the post does not belong to the blog specified in the parameters.', async () => {
    // 🔻 Создаем два отдельных блога
    const [createdBlog_1, createdBlog_2]: BlogViewDto[] =
      await blogsTestManager.createBlog(2);

    // 🔻 Создаем по одному посту в каждом из блогов
    const [createdPost_1]: PostViewDto[] = await postsTestManager.createPost(
      1,
      createdBlog_1.id,
    );
    const [createdPost_2]: PostViewDto[] = await postsTestManager.createPost(
      1,
      createdBlog_2.id,
    );

    // 🔻 Пытаемся удалить post_1, указав в параметре blogId - blog_2.id
    const resDeletePost_1: Response = await request(server)
      .delete(
        `/${GLOBAL_PREFIX}/sa/blogs/${createdBlog_2.id}/posts/${createdPost_1.id}`,
      )
      .set('Authorization', adminCredentialsInBase64) // 🔸 Передаем валидную авторизацию
      .expect(HttpStatus.FORBIDDEN); // 🔸 Ожидаем ошибку 403 Forbidden (пост не принадлежит блогу)

    // 🔻 Убеждаемся, что post_1 остался в системе
    const post_1: PostViewDto = await postsTestManager.getPostById(
      createdPost_1.id,
    );
    expect(post_1).toEqual(createdPost_1);

    // 🔻 Пытаемся удалить post_2, указав blogId от blog_1
    await request(server)
      .delete(
        `/${GLOBAL_PREFIX}/sa/blogs/${createdBlog_1.id}/posts/${createdPost_2.id}`,
      )
      .set('Authorization', adminCredentialsInBase64)
      .expect(HttpStatus.FORBIDDEN); // 🔸 Ожидаем ту же ошибку 403 Forbidden

    // 🔻 Убеждаемся, что post_2 остался в системе
    const post_2: PostViewDto = await postsTestManager.getPostById(
      createdPost_2.id,
    );
    expect(post_2).toEqual(createdPost_2);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resDeletePost_1.body,
        resDeletePost_1.statusCode,
        'Test №5: BlogsAdminController - deletePost() (DELETE: /sa/blogs/:blogId/posts/:postId)',
      );
    }
  });
});
