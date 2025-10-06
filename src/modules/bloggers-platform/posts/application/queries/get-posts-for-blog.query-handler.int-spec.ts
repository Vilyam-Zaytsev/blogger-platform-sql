import { Test, TestingModule } from '@nestjs/testing';
import {
  GetPostsForBlogQuery,
  GetPostsForBlogQueryHandler,
} from './get-posts-for-blog.query-handler';
import { PaginatedViewDto } from '../../../../../core/dto/paginated.view-dto';
import {
  GetPostsQueryParams,
  PostsSortBy,
} from '../../api/input-dto/get-posts-query-params.input-dto';
import { UserContextDto } from '../../../../user-accounts/auth/domain/guards/dto/user-context.dto';
import { PostViewDto } from '../../api/view-dto/post.view-dto';
import { PostsQueryRepository } from '../../infrastructure/query/posts.query-repository';
import { BlogsRepository } from '../../../blogs/infrastructure/blogs.repository';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';
import { Blog } from '../../../blogs/domain/entities/blog.entity';
import { Post } from '../../domain/entities/post.entity';
import { User } from '../../../../user-accounts/users/domain/entities/user.entity';
import { DataSource, Repository } from 'typeorm';
import { DatabaseModule } from '../../../../database/database.module';
import { CoreModule } from '../../../../../core/core.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SortDirection } from '../../../../../core/dto/base.query-params.input-dto';
import { CreateUserDto } from '../../../../user-accounts/users/dto/create-user.dto';
import { BlogInputDto } from '../../../blogs/api/input-dto/blog.input-dto';
import { PostInputDto } from '../../api/input-dto/post.input-dto';
import { PostCreateDto } from '../dto/post.create-dto';
import { UsersFactory } from '../../../../user-accounts/users/application/factories/users.factory';
import { CryptoService } from '../../../../user-accounts/users/application/services/crypto.service';
import { DateService } from '../../../../user-accounts/users/application/services/date.service';
import { getRelatedEntities } from '../../../../../core/utils/get-related-entities.utility';
import { instanceToInstance } from 'class-transformer';
import { isInstance } from 'class-validator';
import { ReactionStatus } from '../../../reactions/domain/entities/reaction.entity';

describe('GetPostsForBlogQueryHandler (Integration)', () => {
  let module: TestingModule;
  let queryHandler: GetPostsForBlogQueryHandler;
  let dataSource: DataSource;
  let postRepo: Repository<Post>;
  let blogRepo: Repository<Blog>;
  let userRepo: Repository<User>;
  let postsQueryRepository: PostsQueryRepository;
  let blogsRepository: BlogsRepository;
  let usersFactory: UsersFactory;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DatabaseModule, CoreModule, TypeOrmModule.forFeature(getRelatedEntities(Post))],
      providers: [
        GetPostsForBlogQueryHandler,
        PostsQueryRepository,
        BlogsRepository,
        UsersFactory,
        CryptoService,
        DateService,
      ],
    }).compile();

    queryHandler = module.get<GetPostsForBlogQueryHandler>(GetPostsForBlogQueryHandler);
    dataSource = module.get<DataSource>(DataSource);
    postsQueryRepository = module.get<PostsQueryRepository>(PostsQueryRepository);
    blogsRepository = module.get<BlogsRepository>(BlogsRepository);
    usersFactory = module.get<UsersFactory>(UsersFactory);
    postRepo = dataSource.getRepository<Post>(Post);
    blogRepo = dataSource.getRepository<Blog>(Blog);
    userRepo = dataSource.getRepository<User>(User);
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE TABLE posts RESTART IDENTITY CASCADE');
    await dataSource.query('TRUNCATE TABLE blogs RESTART IDENTITY CASCADE');
    await dataSource.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
    await dataSource.query('TRUNCATE TABLE reactions RESTART IDENTITY CASCADE');
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

  describe('успешное получение постов блога', () => {
    it('должен возвращать пагинированный список постов конкретного блога для аутентифицированного пользователя', async () => {
      const { id: blogId, name: blogName }: Blog = await createTestBlog();
      const posts: Post[] = await Promise.all([
        createTestPost(blogId, { title: 'Post 1' }),
        createTestPost(blogId, { title: 'Post 2' }),
        createTestPost(blogId, { title: 'Post 3' }),
      ]);
      const { id: userId }: User = await createTestUser();
      const userContext: UserContextDto = createUserContext(userId);
      const queryParams: GetPostsQueryParams = createDefaultQueryParams();

      const result: PaginatedViewDto<PostViewDto> = await queryHandler.execute(
        new GetPostsForBlogQuery(queryParams, userContext, blogId),
      );

      expect(result).toBeDefined();
      expect(result.pagesCount).toBe(1);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
      expect(result.totalCount).toBe(3);
      expect(result.items).toHaveLength(3);
      expect(result.items[0]).toBeInstanceOf(PostViewDto);

      result.items.forEach((item) => {
        expect(item.blogId).toBe(blogId.toString());
        expect(item.blogName).toBe(blogName);
      });

      result.items.forEach((item) => {
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

    it('должен возвращать посты блога для неаутентифицированного пользователя (guest)', async () => {
      const { id: blogId }: Blog = await createTestBlog();
      await Promise.all([
        createTestPost(blogId, { title: 'Public Post 1' }),
        createTestPost(blogId, { title: 'Public Post 2' }),
      ]);
      const queryParams: GetPostsQueryParams = createDefaultQueryParams();

      const result: PaginatedViewDto<PostViewDto> = await queryHandler.execute(
        new GetPostsForBlogQuery(queryParams, null, blogId),
      );

      expect(result).toBeDefined();
      expect(result.totalCount).toBe(2);
      expect(result.items).toHaveLength(2);

      result.items.forEach((item) => {
        expect(item.blogId).toBe(blogId.toString());
        expect(item.extendedLikesInfo.myStatus).toBe(ReactionStatus.None);
      });
    });

    it('должен возвращать пустой список когда в блоге нет постов', async () => {
      const { id: blogId }: Blog = await createTestBlog();
      const { id: userId }: User = await createTestUser();
      const userContext: UserContextDto = createUserContext(userId);
      const queryParams: GetPostsQueryParams = createDefaultQueryParams();

      const result: PaginatedViewDto<PostViewDto> = await queryHandler.execute(
        new GetPostsForBlogQuery(queryParams, userContext, blogId),
      );

      expect(result).toBeDefined();
      expect(result.pagesCount).toBe(0);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
      expect(result.totalCount).toBe(0);
      expect(result.items).toHaveLength(0);
      expect(Array.isArray(result.items)).toBe(true);
    });

    it('должен возвращать посты только указанного блога, игнорируя посты других блогов', async () => {
      const { id: blogId_1 } = await createTestBlog({ name: 'Blog 1' });
      const { id: blogId_2 } = await createTestBlog({ name: 'Blog 2' });

      const post1Blog1: Post = await createTestPost(blogId_1, { title: 'Post from Blog 1' });
      const post2Blog1: Post = await createTestPost(blogId_1, {
        title: 'Another post from Blog 1',
      });
      await createTestPost(blogId_2, { title: 'Post from Blog 2' });

      const { id: userId }: User = await createTestUser();
      const userContext: UserContextDto = createUserContext(userId);
      const queryParams: GetPostsQueryParams = createDefaultQueryParams();

      const result: PaginatedViewDto<PostViewDto> = await queryHandler.execute(
        new GetPostsForBlogQuery(queryParams, userContext, blogId_1),
      );

      expect(result.totalCount).toBe(2);
      expect(result.items).toHaveLength(2);

      result.items.forEach((item) => {
        expect(item.blogId).toBe(blogId_1.toString());
        expect(item.blogName).toBe('Blog 1');
      });

      const postIds: number[] = result.items.map((item) => Number(item.id)).sort();
      const expectedIds: number[] = [post1Blog1.id, post2Blog1.id].sort();
      expect(postIds).toEqual(expectedIds);
    });

    it('должен возвращать посты с корректными данными блога', async () => {
      const createdBlog: Blog = await createTestBlog({
        name: 'AmazingTechBlog',
        description: 'Best tech blog ever',
        websiteUrl: 'https://amazing-tech.example.com',
      });
      const createdPost: Post = await createTestPost(createdBlog.id, {
        title: 'Amazing Post',
        shortDescription: 'This is an amazing post',
        content: 'Content of the amazing post',
      });

      const { id: userId }: User = await createTestUser();
      const userContext: UserContextDto = createUserContext(userId);
      const queryParams: GetPostsQueryParams = createDefaultQueryParams();

      const result: PaginatedViewDto<PostViewDto> = await queryHandler.execute(
        new GetPostsForBlogQuery(queryParams, userContext, createdBlog.id),
      );

      expect(result.items).toHaveLength(1);
      const post: PostViewDto = result.items[0];
      expect(post.blogId).toBe(createdBlog.id.toString());
      expect(post.blogName).toBe(createdBlog.name);
      expect(post.title).toBe(createdPost.title);
      expect(post.shortDescription).toBe(createdPost.shortDescription);
      expect(post.content).toBe(createdPost.content);
    });
  });

  describe('обработка ошибок', () => {
    it('должен выбрасывать DomainException при попытке получить посты несуществующего блога', async () => {
      const nonExistentBlogId = 99999;
      const { id: userId }: User = await createTestUser();
      const userContext: UserContextDto = createUserContext(userId);
      const queryParams: GetPostsQueryParams = createDefaultQueryParams();

      await expect(
        queryHandler.execute(new GetPostsForBlogQuery(queryParams, userContext, nonExistentBlogId)),
      ).rejects.toThrow(DomainException);

      try {
        await queryHandler.execute(
          new GetPostsForBlogQuery(queryParams, userContext, nonExistentBlogId),
        );
        fail('Ожидали DomainException');
      } catch (error) {
        expect(error).toBeInstanceOf(DomainException);
        expect(error.code).toBe(DomainExceptionCode.NotFound);
        expect(error.message).toContain(`The blog with ID (${nonExistentBlogId}) does not exist`);
        expect(error.extensions).toBeDefined();
        expect(Array.isArray(error.extensions)).toBe(true);
      }
    });

    it('должен выбрасывать DomainException для несуществующего блога без пользователя', async () => {
      const nonExistentBlogId = 88888;
      const queryParams: GetPostsQueryParams = createDefaultQueryParams();

      await expect(
        queryHandler.execute(new GetPostsForBlogQuery(queryParams, null, nonExistentBlogId)),
      ).rejects.toThrow(DomainException);

      try {
        await queryHandler.execute(new GetPostsForBlogQuery(queryParams, null, nonExistentBlogId));
        fail('Ожидали DomainException');
      } catch (error) {
        expect(error).toBeInstanceOf(DomainException);
        expect(error.code).toBe(DomainExceptionCode.NotFound);
        expect(error.message).toBe(`The blog with ID (${nonExistentBlogId}) does not exist`);
      }
    });

    it('должен выбрасывать ошибку при попытке получить посты удаленного блога', async () => {
      const { id: blogId }: Blog = await createTestBlog();
      await createTestPost(blogId);
      await blogRepo.softDelete(blogId);

      const { id: userId }: User = await createTestUser();
      const userContext: UserContextDto = createUserContext(userId);
      const queryParams: GetPostsQueryParams = createDefaultQueryParams();

      await expect(
        queryHandler.execute(new GetPostsForBlogQuery(queryParams, userContext, blogId)),
      ).rejects.toThrow(DomainException);
    });

    it('должен корректно обрабатывать последовательные запросы несуществующих блогов', async () => {
      const nonExistentIds: number[] = [77777, 66666, 55555, 44444, 33333, 22222, 11111];
      const { id: userId }: User = await createTestUser();
      const userContext: UserContextDto = createUserContext(userId);
      const queryParams: GetPostsQueryParams = createDefaultQueryParams();

      for (const blogId of nonExistentIds) {
        await expect(
          queryHandler.execute(new GetPostsForBlogQuery(queryParams, userContext, blogId)),
        ).rejects.toThrow(DomainException);
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

    it('должен корректно обрабатывать blogId равный нулю', async () => {
      const queryParams: GetPostsQueryParams = createDefaultQueryParams();

      await expect(
        queryHandler.execute(new GetPostsForBlogQuery(queryParams, userContext, 0)),
      ).rejects.toThrow(DomainException);
    });

    it('должен корректно обрабатывать отрицательный blogId', async () => {
      const queryParams: GetPostsQueryParams = createDefaultQueryParams();

      await expect(
        queryHandler.execute(new GetPostsForBlogQuery(queryParams, userContext, -1)),
      ).rejects.toThrow(DomainException);

      await expect(
        queryHandler.execute(new GetPostsForBlogQuery(queryParams, userContext, -999)),
      ).rejects.toThrow(DomainException);
    });

    it('должен корректно обрабатывать очень большой blogId', async () => {
      const veryLargeBlogId: number = Number.MAX_SAFE_INTEGER;
      const queryParams: GetPostsQueryParams = createDefaultQueryParams();

      await expect(
        queryHandler.execute(new GetPostsForBlogQuery(queryParams, userContext, veryLargeBlogId)),
      ).rejects.toThrow();
    });

    it('должен корректно обрабатывать дробный blogId', async () => {
      const floatBlogId: number = 123.456;
      const queryParams: GetPostsQueryParams = createDefaultQueryParams();

      await expect(
        queryHandler.execute(new GetPostsForBlogQuery(queryParams, userContext, floatBlogId)),
      ).rejects.toThrow();
    });

    it('должен корректно обрабатывать pageNumber равный нулю', async () => {
      const queryParams: GetPostsQueryParams = createDefaultQueryParams({ pageNumber: 0 });

      await expect(
        queryHandler.execute(new GetPostsForBlogQuery(queryParams, userContext, blog.id)),
      ).rejects.toThrow();
    });

    it('должен корректно обрабатывать отрицательные параметры пагинации', async () => {
      const queryParams = createDefaultQueryParams({
        pageNumber: -1,
        pageSize: -5,
      });

      await expect(
        queryHandler.execute(new GetPostsForBlogQuery(queryParams, userContext, blog.id)),
      ).rejects.toThrow();
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

      const postPromises: Promise<Post>[] = Array.from({ length: 25 }, (_, i) =>
        createTestPost(blog.id, { title: `Post ${i + 1}` }),
      );
      await Promise.all(postPromises);
    });

    it('должен корректно обрабатывать первую страницу', async () => {
      const queryParams: GetPostsQueryParams = createDefaultQueryParams({});

      const result: PaginatedViewDto<PostViewDto> = await queryHandler.execute(
        new GetPostsForBlogQuery(queryParams, userContext, blog.id),
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
      });

      const result: PaginatedViewDto<PostViewDto> = await queryHandler.execute(
        new GetPostsForBlogQuery(queryParams, userContext, blog.id),
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
      });

      const result: PaginatedViewDto<PostViewDto> = await queryHandler.execute(
        new GetPostsForBlogQuery(queryParams, userContext, blog.id),
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
        const queryParams = createDefaultQueryParams({
          pageSize: testCase.pageSize,
        });

        const result: PaginatedViewDto<PostViewDto> = await queryHandler.execute(
          new GetPostsForBlogQuery(queryParams, userContext, blog.id),
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
      });

      const result: PaginatedViewDto<PostViewDto> = await queryHandler.execute(
        new GetPostsForBlogQuery(queryParams, userContext, blog.id),
      );

      expect(result.page).toBe(10);
      expect(result.pageSize).toBe(10);
      expect(result.totalCount).toBe(25);
      expect(result.pagesCount).toBe(3);
      expect(result.items).toHaveLength(0);
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
        const post = await createTestPost(blog.id, {
          title: `Post ${String.fromCharCode(65 + i)}`,
        });
        posts.push(post);
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    });

    it('должен сортировать по createdAt по убыванию (по умолчанию)', async () => {
      const queryParams: GetPostsQueryParams = createDefaultQueryParams({});

      const result: PaginatedViewDto<PostViewDto> = await queryHandler.execute(
        new GetPostsForBlogQuery(queryParams, userContext, blog.id),
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
        new GetPostsForBlogQuery(queryParams, userContext, blog.id),
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
        new GetPostsForBlogQuery(queryParams, userContext, blog.id),
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
        new GetPostsForBlogQuery(queryParams, userContext, blog.id),
      );

      expect(result.items).toHaveLength(5);

      const titles: string[] = result.items.map((item) => item.title);
      const sortedTitles: string[] = [...titles].sort().reverse();
      expect(titles).toEqual(sortedTitles);
    });

    it('должен поддерживать все типы сортировки из enum', async () => {
      const sortByValues: PostsSortBy[] = Object.values(PostsSortBy);

      for (const sortBy of sortByValues) {
        const queryParams: GetPostsQueryParams = createDefaultQueryParams({ sortBy });

        const result: PaginatedViewDto<PostViewDto> = await queryHandler.execute(
          new GetPostsForBlogQuery(queryParams, userContext, blog.id),
        );
        expect(result).toBeDefined();
        expect(result.items).toBeDefined();
      }
    });
  });

  describe('интеграция с repository', () => {
    it('должен правильно вызывать методы repository в нужном порядке', async () => {
      const { id: blogId }: Blog = await createTestBlog();
      await createTestPost(blogId);
      const { id: userId }: User = await createTestUser();
      const userContext: UserContextDto = createUserContext(userId);
      const queryParams: GetPostsQueryParams = createDefaultQueryParams();

      const getBlogByIdSpy = jest.spyOn(blogsRepository, 'getById');
      const getAllPostsSpy = jest.spyOn(postsQueryRepository, 'getAll');

      await queryHandler.execute(new GetPostsForBlogQuery(queryParams, userContext, blogId));

      expect(getBlogByIdSpy).toHaveBeenCalledWith(blogId);
      expect(getBlogByIdSpy).toHaveBeenCalledTimes(1);
      expect(getAllPostsSpy).toHaveBeenCalledWith(queryParams, userContext, blogId);
      expect(getAllPostsSpy).toHaveBeenCalledTimes(1);

      const getBlogCall: number = getBlogByIdSpy.mock.invocationCallOrder[0];
      const getAllPostsCall: number = getAllPostsSpy.mock.invocationCallOrder[0];
      expect(getBlogCall).toBeLessThan(getAllPostsCall);

      getBlogByIdSpy.mockRestore();
      getAllPostsSpy.mockRestore();
    });

    it('должен передавать null user в repository для неаутентифицированного запроса', async () => {
      const { id: blogId }: Blog = await createTestBlog();
      await createTestPost(blogId);
      const queryParams: GetPostsQueryParams = createDefaultQueryParams();

      const getAllPostsSpy = jest.spyOn(postsQueryRepository, 'getAll');

      await queryHandler.execute(new GetPostsForBlogQuery(queryParams, null, blogId));

      expect(getAllPostsSpy).toHaveBeenCalledWith(queryParams, null, blogId);
      expect(getAllPostsSpy).toHaveBeenCalledTimes(1);

      getAllPostsSpy.mockRestore();
    });

    it('должен передавать правильный blogId в postsQueryRepository.getAll', async () => {
      const { id: blogId }: Blog = await createTestBlog();
      await createTestPost(blogId);
      const { id: userId }: User = await createTestUser();
      const userContext: UserContextDto = createUserContext(userId);
      const queryParams: GetPostsQueryParams = createDefaultQueryParams();

      const getAllPostsSpy = jest.spyOn(postsQueryRepository, 'getAll');

      await queryHandler.execute(new GetPostsForBlogQuery(queryParams, userContext, blogId));

      expect(getAllPostsSpy).toHaveBeenCalledWith(queryParams, userContext, blogId);

      getAllPostsSpy.mockRestore();
    });

    it('не должен вызывать getAll если блог не найден', async () => {
      const nonExistentBlogId = 99999;
      const { id: userId }: User = await createTestUser();
      const userContext: UserContextDto = createUserContext(userId);
      const queryParams: GetPostsQueryParams = createDefaultQueryParams();

      const getAllPostsSpy = jest.spyOn(postsQueryRepository, 'getAll');

      await expect(
        queryHandler.execute(new GetPostsForBlogQuery(queryParams, userContext, nonExistentBlogId)),
      ).rejects.toThrow(DomainException);

      expect(getAllPostsSpy).not.toHaveBeenCalled();

      getAllPostsSpy.mockRestore();
    });

    it('должен корректно обрабатывать исключения от blogsRepository', async () => {
      const nonExistentBlogId = 99999;
      const { id: userId }: User = await createTestUser();
      const userContext: UserContextDto = createUserContext(userId);
      const queryParams: GetPostsQueryParams = createDefaultQueryParams();

      const getBlogByIdSpy = jest.spyOn(blogsRepository, 'getById').mockResolvedValue(null);

      await expect(
        queryHandler.execute(new GetPostsForBlogQuery(queryParams, userContext, nonExistentBlogId)),
      ).rejects.toThrow(DomainException);

      expect(getBlogByIdSpy).toHaveBeenCalledWith(nonExistentBlogId);

      getBlogByIdSpy.mockRestore();
    });
  });

  describe('консистентность данных', () => {
    it('должен возвращать консистентные данные при повторных запросах', async () => {
      const { id: blogId }: Blog = await createTestBlog();
      await Promise.all([
        createTestPost(blogId, { title: 'Post 1' }),
        createTestPost(blogId, { title: 'Post 2' }),
        createTestPost(blogId, { title: 'Post 3' }),
      ]);
      const { id: userId }: User = await createTestUser();
      const userContext: UserContextDto = createUserContext(userId);
      const queryParams: GetPostsQueryParams = createDefaultQueryParams();

      const result1: PaginatedViewDto<PostViewDto> = await queryHandler.execute(
        new GetPostsForBlogQuery(queryParams, userContext, blogId),
      );
      const result2: PaginatedViewDto<PostViewDto> = await queryHandler.execute(
        new GetPostsForBlogQuery(queryParams, userContext, blogId),
      );

      expect(result1.totalCount).toBe(result2.totalCount);
      expect(result1.pagesCount).toBe(result2.pagesCount);
      expect(result1.items).toHaveLength(result2.items.length);

      const ids1: string[] = result1.items.map((item) => item.id).sort();
      const ids2: string[] = result2.items.map((item) => item.id).sort();
      expect(ids1).toEqual(ids2);
    });

    it('должен отражать изменения после добавления новых постов в блог', async () => {
      const { id: blogId }: Blog = await createTestBlog();
      await createTestPost(blogId, { title: 'Initial Post' });
      const { id: userId }: User = await createTestUser();
      const userContext: UserContextDto = createUserContext(userId);
      const queryParams: GetPostsQueryParams = createDefaultQueryParams();

      const resultBefore: PaginatedViewDto<PostViewDto> = await queryHandler.execute(
        new GetPostsForBlogQuery(queryParams, userContext, blogId),
      );
      expect(resultBefore.totalCount).toBe(1);

      await createTestPost(blogId, { title: 'New Post' });

      const resultAfter: PaginatedViewDto<PostViewDto> = await queryHandler.execute(
        new GetPostsForBlogQuery(queryParams, userContext, blogId),
      );
      expect(resultAfter.totalCount).toBe(2);
      expect(resultAfter.items).toHaveLength(2);
    });

    it('должен корректно обрабатывать удаленные посты из блога', async () => {
      const { id: blogId }: Blog = await createTestBlog();
      const { id: postId_1 } = await createTestPost(blogId, { title: 'Post 1' });
      const { id: postId_2 } = await createTestPost(blogId, { title: 'Post 2' });
      const { id: userId }: User = await createTestUser();
      const userContext: UserContextDto = createUserContext(userId);
      const queryParams: GetPostsQueryParams = createDefaultQueryParams();

      const resultBefore: PaginatedViewDto<PostViewDto> = await queryHandler.execute(
        new GetPostsForBlogQuery(queryParams, userContext, blogId),
      );
      expect(resultBefore.totalCount).toBe(2);

      await postRepo.softDelete(postId_1);

      const resultAfter: PaginatedViewDto<PostViewDto> = await queryHandler.execute(
        new GetPostsForBlogQuery(queryParams, userContext, blogId),
      );
      expect(resultAfter.totalCount).toBe(1);
      expect(resultAfter.items[0].id).toBe(postId_2.toString());
    });

    it('должен возвращать актуальные данные после обновления блога', async () => {
      const blog: Blog = await createTestBlog({ name: 'OriginBlogName' });
      await createTestPost(blog.id, { title: 'Test Post' });
      const { id: userId }: User = await createTestUser();
      const userContext: UserContextDto = createUserContext(userId);
      const queryParams: GetPostsQueryParams = createDefaultQueryParams();

      const resultBefore: PaginatedViewDto<PostViewDto> = await queryHandler.execute(
        new GetPostsForBlogQuery(queryParams, userContext, blog.id),
      );
      expect(resultBefore.items[0].blogName).toBe(blog.name);

      await blogRepo.update(blog.id, { name: 'UpdatedBlogName' });

      const resultAfter: PaginatedViewDto<PostViewDto> = await queryHandler.execute(
        new GetPostsForBlogQuery(queryParams, userContext, blog.id),
      );
      expect(resultAfter.items[0].blogName).toBe('UpdatedBlogName');
      expect(resultAfter.items[0].id).toBe(resultBefore.items[0].id);
    });
  });

  describe('формат возвращаемых данных', () => {
    it('должен возвращать корректную структуру PaginatedViewDto', async () => {
      const { id: blogId }: Blog = await createTestBlog();
      await createTestPost(blogId);
      const { id: userId }: User = await createTestUser();
      const userContext: UserContextDto = createUserContext(userId);
      const queryParams: GetPostsQueryParams = createDefaultQueryParams();

      const result: PaginatedViewDto<PostViewDto> = await queryHandler.execute(
        new GetPostsForBlogQuery(queryParams, userContext, blogId),
      );

      expect(result).toHaveProperty('pagesCount');
      expect(result).toHaveProperty('page');
      expect(result).toHaveProperty('pageSize');
      expect(result).toHaveProperty('totalCount');
      expect(result).toHaveProperty('items');

      expect(typeof result.pagesCount).toBe('number');
      expect(typeof result.page).toBe('number');
      expect(typeof result.pageSize).toBe('number');
      expect(typeof result.totalCount).toBe('number');
      expect(Array.isArray(result.items)).toBe(true);
    });

    it('должен возвращать корректную структуру PostViewDto в items', async () => {
      const { id: blogId }: Blog = await createTestBlog();
      await createTestPost(blogId, {
        title: 'Test Post',
        shortDescription: 'Test Description',
        content: 'Test Content',
      });
      const { id: userId }: User = await createTestUser();
      const userContext: UserContextDto = createUserContext(userId);
      const queryParams: GetPostsQueryParams = createDefaultQueryParams();

      const result: PaginatedViewDto<PostViewDto> = await queryHandler.execute(
        new GetPostsForBlogQuery(queryParams, userContext, blogId),
      );

      expect(result.items).toHaveLength(1);
      const post: PostViewDto = result.items[0];

      expect(post).toHaveProperty('id');
      expect(post).toHaveProperty('title');
      expect(post).toHaveProperty('shortDescription');
      expect(post).toHaveProperty('content');
      expect(post).toHaveProperty('blogId');
      expect(post).toHaveProperty('blogName');
      expect(post).toHaveProperty('extendedLikesInfo');
      expect(post).toHaveProperty('createdAt');

      expect(typeof post.id).toBe('string');
      expect(typeof post.title).toBe('string');
      expect(typeof post.shortDescription).toBe('string');
      expect(typeof post.content).toBe('string');
      expect(typeof post.blogId).toBe('string');
      expect(typeof post.blogName).toBe('string');
      expect(typeof post.createdAt).toBe('string');

      expect(post.title).toBe('Test Post');
      expect(post.shortDescription).toBe('Test Description');
      expect(post.content).toBe('Test Content');
      expect(post.blogId).toBe(blogId.toString());
    });

    it('должен возвращать корректные значения пагинации для пустого результата', async () => {
      const { id: blogId }: Blog = await createTestBlog();
      const { id: userId }: User = await createTestUser();
      const userContext: UserContextDto = createUserContext(userId);
      const queryParams: GetPostsQueryParams = createDefaultQueryParams();

      const result: PaginatedViewDto<PostViewDto> = await queryHandler.execute(
        new GetPostsForBlogQuery(queryParams, userContext, blogId),
      );

      expect(result.pagesCount).toBe(0);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
      expect(result.totalCount).toBe(0);
      expect(result.items).toEqual([]);
    });

    it('должен возвращать корректный формат даты в ISO строке', async () => {
      const { id: blogId }: Blog = await createTestBlog();
      await createTestPost(blogId);
      const { id: userId }: User = await createTestUser();
      const userContext: UserContextDto = createUserContext(userId);
      const queryParams: GetPostsQueryParams = createDefaultQueryParams();

      const result: PaginatedViewDto<PostViewDto> = await queryHandler.execute(
        new GetPostsForBlogQuery(queryParams, userContext, blogId),
      );

      expect(result.items).toHaveLength(1);
      const post: PostViewDto = result.items[0];

      expect(post.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

      const parsedDate = new Date(post.createdAt);
      expect(parsedDate.toString()).not.toBe('Invalid Date');
      expect(parsedDate.toISOString()).toBe(post.createdAt);
    });
  });
});
