import { Test, TestingModule } from '@nestjs/testing';
import { GetPostsQuery, GetPostsQueryHandler } from './get-posts.query-handler';
import {
  GetPostsQueryParams,
  PostsSortBy,
} from '../../api/input-dto/get-posts-query-params.input-dto';
import { SortDirection } from '../../../../../core/dto/base.query-params.input-dto';
import { PaginatedViewDto } from '../../../../../core/dto/paginated.view-dto';
import { PostViewDto } from '../../api/view-dto/post.view-dto';
import { PostsQueryRepository } from '../../infrastructure/query/posts.query-repository';
import { UserContextDto } from '../../../../user-accounts/auth/domain/guards/dto/user-context.dto';
import { Post } from '../../domain/entities/post.entity';
import { Blog } from '../../../blogs/domain/entities/blog.entity';
import { User } from '../../../../user-accounts/users/domain/entities/user.entity';
import { DataSource, Repository } from 'typeorm';
import { DatabaseModule } from '../../../../database/database.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersFactory } from '../../../../user-accounts/users/application/factories/users.factory';
import { CryptoService } from '../../../../user-accounts/users/application/services/crypto.service';
import { DateService } from '../../../../user-accounts/users/application/services/date.service';
import { CreateUserDto } from '../../../../user-accounts/users/dto/create-user.dto';
import { BlogInputDto } from '../../../blogs/api/input-dto/blog.input-dto';
import { PostInputDto } from '../../api/input-dto/post.input-dto';
import { PostCreateDto } from '../dto/post.create-dto';
import { getRelatedEntities } from '../../../../../core/utils/get-related-entities.utility';
import { ReactionStatus } from '../../../reactions/domain/entities/reaction.entity';
import { configModule } from '../../../../../dynamic-config.module';
import { TransactionHelper } from '../../../../../trasaction.helper';

describe('GetPostsQueryHandler (Integration)', () => {
  let module: TestingModule;
  let queryHandler: GetPostsQueryHandler;
  let dataSource: DataSource;
  let postRepo: Repository<Post>;
  let blogRepo: Repository<Blog>;
  let userRepo: Repository<User>;
  let usersFactory: UsersFactory;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [configModule, DatabaseModule, TypeOrmModule.forFeature(getRelatedEntities(Post))],
      providers: [
        GetPostsQueryHandler,
        PostsQueryRepository,
        UsersFactory,
        CryptoService,
        DateService,
        TransactionHelper,
      ],
    }).compile();

    queryHandler = module.get<GetPostsQueryHandler>(GetPostsQueryHandler);
    dataSource = module.get<DataSource>(DataSource);
    usersFactory = module.get<UsersFactory>(UsersFactory);
    postRepo = dataSource.getRepository<Post>(Post);
    blogRepo = dataSource.getRepository<Blog>(Blog);
    userRepo = dataSource.getRepository<User>(User);
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE TABLE blogs RESTART IDENTITY CASCADE');
    await dataSource.query('TRUNCATE TABLE posts RESTART IDENTITY CASCADE');
    await dataSource.query('TRUNCATE TABLE reactions RESTART IDENTITY CASCADE');
    await dataSource.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
  });

  afterAll(async () => {
    await dataSource.destroy();
    await module.close();
  });

  const createTestUser = async (): Promise<User> => {
    const dto: CreateUserDto = {
      login: 'test_user',
      email: 'test.user@example.com',
      password: 'qwerty',
    };

    const user: User = await usersFactory.create(dto);
    return await userRepo.save(user);
  };

  const createUserContext = (userId: number): UserContextDto => {
    const context = new UserContextDto();
    context.id = userId;
    return context;
  };

  const createTestBlog = async (blogData?: Partial<BlogInputDto>): Promise<Blog> => {
    const defaultData: BlogInputDto = {
      name: 'Test Blog',
      description: 'Test blog description',
      websiteUrl: 'https://www.test.example.com',
      ...blogData,
    };

    const blog: Blog = Blog.create(defaultData);
    return await blogRepo.save(blog);
  };

  const createTestPost = async (
    blogId: number,
    postData?: Partial<PostInputDto>,
  ): Promise<Post> => {
    const defaultData: PostCreateDto = {
      title: 'Test Post',
      shortDescription: 'Test post short description',
      content: 'Test post content',
      blogId,
      ...postData,
    };

    const post: Post = Post.create(defaultData);
    return await postRepo.save(post);
  };

  const createDefaultQueryParams = (
    overrides?: Partial<GetPostsQueryParams>,
  ): GetPostsQueryParams => {
    const params = new GetPostsQueryParams();
    return Object.assign(params, overrides);
  };

  describe('успешное получение постов', () => {
    it('должен возвращать пагинированный список постов с дефолтными параметрами', async () => {
      const { id: blogId }: Blog = await createTestBlog();
      await Promise.all([
        createTestPost(blogId, { title: 'Post 1' }),
        createTestPost(blogId, { title: 'Post 2' }),
        createTestPost(blogId, { title: 'Post 3' }),
      ]);
      const { id: userId }: User = await createTestUser();
      const userContext: UserContextDto = createUserContext(userId);
      const queryParams: GetPostsQueryParams = createDefaultQueryParams();
      const result: PaginatedViewDto<PostViewDto> = await queryHandler.execute(
        new GetPostsQuery(queryParams, userContext),
      );

      expect(result).toBeDefined();
      expect(result.pagesCount).toBe(1);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
      expect(result.totalCount).toBe(3);
      expect(result.items).toHaveLength(3);
      expect(result.items[0]).toBeInstanceOf(PostViewDto);

      result.items.forEach((item, index) => {
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('title');
        expect(item).toHaveProperty('shortDescription');
        expect(item).toHaveProperty('content');
        expect(item).toHaveProperty('blogId');
        expect(item).toHaveProperty('blogName');
        expect(item).toHaveProperty('extendedLikesInfo');
        expect(item).toHaveProperty('createdAt');
      });
    });

    it('должен возвращать посты для неаутентифицированного пользователя', async () => {
      const { id: blogId }: Blog = await createTestBlog();
      await Promise.all([
        createTestPost(blogId, { title: 'Public Post 1' }),
        createTestPost(blogId, { title: 'Public Post 2' }),
      ]);
      const queryParams: GetPostsQueryParams = createDefaultQueryParams();

      const result: PaginatedViewDto<PostViewDto> = await queryHandler.execute(
        new GetPostsQuery(queryParams, null),
      );

      expect(result).toBeDefined();
      expect(result.totalCount).toBe(2);
      expect(result.items).toHaveLength(2);

      result.items.forEach((item) => {
        expect(item.extendedLikesInfo.myStatus).toBe(ReactionStatus.None);
      });
    });

    it('должен возвращать пустой список когда постов нет', async () => {
      const { id: userId }: User = await createTestUser();
      const userContext: UserContextDto = createUserContext(userId);
      const queryParams: GetPostsQueryParams = createDefaultQueryParams();

      const result: PaginatedViewDto<PostViewDto> = await queryHandler.execute(
        new GetPostsQuery(queryParams, userContext),
      );

      expect(result).toBeDefined();
      expect(result.pagesCount).toBe(0);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
      expect(result.totalCount).toBe(0);
      expect(result.items).toHaveLength(0);
      expect(Array.isArray(result.items)).toBe(true);
    });

    it('должен возвращать посты из разных блогов', async () => {
      const { id: blogId_1 }: Blog = await createTestBlog({ name: 'Blog 1' });
      const { id: blogId_2 }: Blog = await createTestBlog({ name: 'Blog 2' });
      await Promise.all([
        createTestPost(blogId_1, { title: 'Post from Blog 1' }),
        createTestPost(blogId_2, { title: 'Post from Blog 2' }),
        createTestPost(blogId_1, { title: 'Another post from Blog 1' }),
      ]);
      const { id: userId }: User = await createTestUser();
      const userContext: UserContextDto = createUserContext(userId);
      const queryParams: GetPostsQueryParams = createDefaultQueryParams();

      const result: PaginatedViewDto<PostViewDto> = await queryHandler.execute(
        new GetPostsQuery(queryParams, userContext),
      );

      expect(result.totalCount).toBe(3);
      expect(result.items).toHaveLength(3);

      const blogNames: string[] = result.items.map((item) => item.blogName);
      expect(blogNames).toContain('Blog 1');
      expect(blogNames).toContain('Blog 2');
    });
  });

  describe('пагинация', () => {
    let blog: Blog;
    let user: User;
    let userContext: UserContextDto;

    beforeEach(async () => {
      blog = await createTestBlog();
      user = await createTestUser();
      userContext = createUserContext(user.id);

      const postPromises: Promise<Post>[] = Array.from({ length: 25 }, async (_, i) => {
        return createTestPost(blog.id, { title: `Post ${i + 1}` });
      });
      await Promise.all(postPromises);
    });

    it('должен корректно обрабатывать первую страницу', async () => {
      const queryParams: GetPostsQueryParams = createDefaultQueryParams({
        pageNumber: 1,
        pageSize: 10,
      });

      const result: PaginatedViewDto<PostViewDto> = await queryHandler.execute(
        new GetPostsQuery(queryParams, userContext),
      );

      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
      expect(result.totalCount).toBe(25);
      expect(result.pagesCount).toBe(3);
      expect(result.items).toHaveLength(10);
    });

    it('должен корректно обрабатывать вторую страницу', async () => {
      const queryParams: GetPostsQueryParams = createDefaultQueryParams({
        pageNumber: 2,
        pageSize: 10,
      });

      const result: PaginatedViewDto<PostViewDto> = await queryHandler.execute(
        new GetPostsQuery(queryParams, userContext),
      );

      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(10);
      expect(result.totalCount).toBe(25);
      expect(result.pagesCount).toBe(3);
      expect(result.items).toHaveLength(10);
    });

    it('должен корректно обрабатывать последнюю страницу', async () => {
      const queryParams: GetPostsQueryParams = createDefaultQueryParams({
        pageNumber: 3,
        pageSize: 10,
      });

      const result: PaginatedViewDto<PostViewDto> = await queryHandler.execute(
        new GetPostsQuery(queryParams, userContext),
      );

      expect(result.page).toBe(3);
      expect(result.pageSize).toBe(10);
      expect(result.totalCount).toBe(25);
      expect(result.pagesCount).toBe(3);
      expect(result.items).toHaveLength(5);
    });

    it('должен корректно обрабатывать разные размеры страниц', async () => {
      const testCases = [
        { pageSize: 5, expectedPagesCount: 5 },
        { pageSize: 15, expectedPagesCount: 2 },
        { pageSize: 25, expectedPagesCount: 1 },
        { pageSize: 50, expectedPagesCount: 1 },
      ];

      for (const testCase of testCases) {
        const queryParams: GetPostsQueryParams = createDefaultQueryParams({
          pageNumber: 1,
          pageSize: testCase.pageSize,
        });

        const result: PaginatedViewDto<PostViewDto> = await queryHandler.execute(
          new GetPostsQuery(queryParams, userContext),
        );

        expect(result.pageSize).toBe(testCase.pageSize);
        expect(result.pagesCount).toBe(testCase.expectedPagesCount);
        expect(result.totalCount).toBe(25);
        expect(result.items.length).toBeLessThanOrEqual(testCase.pageSize);
      }
    });

    it('должен корректно обрабатывать запрос страницы больше чем существует', async () => {
      const queryParams: GetPostsQueryParams = createDefaultQueryParams({
        pageNumber: 10,
        pageSize: 10,
      });

      const result: PaginatedViewDto<PostViewDto> = await queryHandler.execute(
        new GetPostsQuery(queryParams, userContext),
      );

      expect(result.page).toBe(10);
      expect(result.pageSize).toBe(10);
      expect(result.totalCount).toBe(25);
      expect(result.pagesCount).toBe(3);
      expect(result.items).toHaveLength(0);
    });

    it('должен корректно обрабатывать минимальные параметры пагинации', async () => {
      const queryParams: GetPostsQueryParams = createDefaultQueryParams({
        pageNumber: 1,
        pageSize: 1,
      });

      const result: PaginatedViewDto<PostViewDto> = await queryHandler.execute(
        new GetPostsQuery(queryParams, userContext),
      );

      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(1);
      expect(result.totalCount).toBe(25);
      expect(result.pagesCount).toBe(25);
      expect(result.items).toHaveLength(1);
    });
  });

  describe('сортировка', () => {
    let blog: Blog;
    let user: User;
    let userContext: UserContextDto;
    let posts: Post[];

    beforeEach(async () => {
      blog = await createTestBlog();
      user = await createTestUser();
      userContext = createUserContext(user.id);

      posts = [];
      for (let i = 0; i < 5; i++) {
        const post: Post = await createTestPost(blog.id, {
          title: `Post ${String.fromCharCode(65 + i)}`,
        });
        posts.push(post);
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    });

    it('должен сортировать по createdAt по убыванию (по умолчанию)', async () => {
      const queryParams: GetPostsQueryParams = createDefaultQueryParams();

      const result: PaginatedViewDto<PostViewDto> = await queryHandler.execute(
        new GetPostsQuery(queryParams, userContext),
      );

      expect(result.items).toHaveLength(5);

      for (let i = 0; i < result.items.length - 1; i++) {
        const currentDate = new Date(result.items[i].createdAt);
        const nextDate = new Date(result.items[i + 1].createdAt);
        expect(currentDate.getTime()).toBeGreaterThanOrEqual(nextDate.getTime());
      }
    });

    it('должен сортировать по createdAt по возрастанию', async () => {
      const queryParams: GetPostsQueryParams = createDefaultQueryParams({
        sortDirection: SortDirection.Ascending,
      });

      const result: PaginatedViewDto<PostViewDto> = await queryHandler.execute(
        new GetPostsQuery(queryParams, userContext),
      );

      expect(result.items).toHaveLength(5);

      for (let i = 0; i < result.items.length - 1; i++) {
        const currentDate = new Date(result.items[i].createdAt);
        const nextDate = new Date(result.items[i + 1].createdAt);
        expect(currentDate.getTime()).toBeLessThanOrEqual(nextDate.getTime());
      }
    });

    it('должен сортировать по title по возрастанию', async () => {
      const queryParams: GetPostsQueryParams = createDefaultQueryParams({
        sortBy: PostsSortBy.Title,
        sortDirection: SortDirection.Ascending,
      });

      const result: PaginatedViewDto<PostViewDto> = await queryHandler.execute(
        new GetPostsQuery(queryParams, userContext),
      );

      expect(result.items).toHaveLength(5);

      const titles: string[] = result.items.map((item) => item.title);
      const sortedTitles: string[] = [...titles].sort();
      expect(titles).toEqual(sortedTitles);
    });

    it('должен сортировать по title по убыванию', async () => {
      const queryParams: GetPostsQueryParams = createDefaultQueryParams({
        sortBy: PostsSortBy.Title,
      });

      const result: PaginatedViewDto<PostViewDto> = await queryHandler.execute(
        new GetPostsQuery(queryParams, userContext),
      );

      expect(result.items).toHaveLength(5);

      const titles: string[] = result.items.map((item) => item.title);
      const sortedTitles: string[] = [...titles].sort().reverse();
      expect(titles).toEqual(sortedTitles);
    });

    it('должен сортировать по blogName', async () => {
      const { id: blogId_1 }: Blog = await createTestBlog({ name: 'A Blog' });
      const { id: blogId_2 }: Blog = await createTestBlog({ name: 'Z Blog' });
      await Promise.all([
        createTestPost(blogId_1, { title: 'Post from A Blog' }),
        createTestPost(blogId_2, { title: 'Post from Z Blog' }),
        createTestPost(blogId_1, { title: 'Another post from A Blog' }),
      ]);

      const queryParams: GetPostsQueryParams = createDefaultQueryParams({
        sortBy: PostsSortBy.BlogName,
        sortDirection: SortDirection.Ascending,
      });

      const result: PaginatedViewDto<PostViewDto> = await queryHandler.execute(
        new GetPostsQuery(queryParams, userContext),
      );

      expect(result.totalCount).toBe(8);

      const blogNames: string[] = result.items.map((item) => item.blogName);
      const sortedBlogNames: string[] = [...blogNames].sort();
      expect(blogNames).toEqual(sortedBlogNames);
    });

    it('должен поддерживать все типы сортировки из enum', async () => {
      const sortByValues: PostsSortBy[] = Object.values(PostsSortBy);

      for (const sortBy of sortByValues) {
        const queryParams: GetPostsQueryParams = createDefaultQueryParams({ sortBy });

        const result: PaginatedViewDto<PostViewDto> = await queryHandler.execute(
          new GetPostsQuery(queryParams, userContext),
        );
        expect(result).toBeDefined();
        expect(result.items).toBeDefined();
      }
    });
  });

  describe('граничные случаи параметров запроса', () => {
    let blog: Blog;
    let user: User;
    let userContext: UserContextDto;

    beforeEach(async () => {
      blog = await createTestBlog();
      user = await createTestUser();
      userContext = createUserContext(user.id);
      await createTestPost(blog.id);
    });

    it('должен корректно обрабатывать pageNumber равный нулю', async () => {
      const queryParams: GetPostsQueryParams = createDefaultQueryParams({ pageNumber: 0 });

      await expect(
        queryHandler.execute(new GetPostsQuery(queryParams, userContext)),
      ).rejects.toThrow();
    });

    it('должен корректно обрабатывать отрицательный pageNumber', async () => {
      const queryParams: GetPostsQueryParams = createDefaultQueryParams({ pageNumber: -1 });

      await expect(
        queryHandler.execute(new GetPostsQuery(queryParams, userContext)),
      ).rejects.toThrow();
    });

    //TODO: странное поведение!
    it('должен корректно обрабатывать pageSize равный нулю', async () => {
      const queryParams: GetPostsQueryParams = createDefaultQueryParams({ pageSize: 0 });

      const result: PaginatedViewDto<PostViewDto> = await queryHandler.execute(
        new GetPostsQuery(queryParams, userContext),
      );
      expect(result).toBeDefined();
    });

    it('должен корректно обрабатывать отрицательный pageSize', async () => {
      const queryParams: GetPostsQueryParams = createDefaultQueryParams({ pageSize: -1 });

      await expect(
        queryHandler.execute(new GetPostsQuery(queryParams, userContext)),
      ).rejects.toThrow();
    });

    it('должен корректно обрабатывать очень большой pageSize', async () => {
      const queryParams: GetPostsQueryParams = createDefaultQueryParams({ pageSize: 1000000 });

      const result: PaginatedViewDto<PostViewDto> = await queryHandler.execute(
        new GetPostsQuery(queryParams, userContext),
      );
      expect(result).toBeDefined();
      expect(result.items.length).toBeLessThanOrEqual(1000000);
    });

    it('должен корректно обрабатывать очень большой pageNumber', async () => {
      const queryParams: GetPostsQueryParams = createDefaultQueryParams({
        pageNumber: Number.MAX_SAFE_INTEGER,
      });

      const result: PaginatedViewDto<PostViewDto> = await queryHandler.execute(
        new GetPostsQuery(queryParams, userContext),
      );
      expect(result).toBeDefined();
      expect(result.items).toHaveLength(0);
    });

    it('должен корректно обрабатывать дробные значения', async () => {
      const queryParams: GetPostsQueryParams = createDefaultQueryParams({
        pageNumber: 1.5,
        pageSize: 10.7,
      });

      const result: PaginatedViewDto<PostViewDto> = await queryHandler.execute(
        new GetPostsQuery(queryParams, userContext),
      );
      expect(result).toBeDefined();
    });
  });
});
