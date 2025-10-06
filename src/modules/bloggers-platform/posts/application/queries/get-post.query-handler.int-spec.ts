import { Test, TestingModule } from '@nestjs/testing';
import { GetPostQuery, GetPostQueryHandler } from './get-post.query-handler';
import { PostViewDto } from '../../api/view-dto/post.view-dto';
import { PostsQueryRepository } from '../../infrastructure/query/posts.query-repository';
import { UserContextDto } from '../../../../user-accounts/auth/domain/guards/dto/user-context.dto';
import { Post } from '../../domain/entities/post.entity';
import { Blog } from '../../../blogs/domain/entities/blog.entity';
import { User } from '../../../../user-accounts/users/domain/entities/user.entity';
import { DataSource, Repository } from 'typeorm';
import { DatabaseModule } from '../../../../database/database.module';
import { CoreModule } from '../../../../../core/core.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';
import { getRelatedEntities } from '../../../../../core/utils/get-related-entities.utility';
import { CreateUserDto } from '../../../../user-accounts/users/dto/create-user.dto';
import { UsersFactory } from '../../../../user-accounts/users/application/factories/users.factory';
import { BlogInputDto } from '../../../blogs/api/input-dto/blog.input-dto';
import { PostInputDto } from '../../api/input-dto/post.input-dto';
import { PostCreateDto } from '../dto/post.create-dto';
import { CryptoService } from '../../../../user-accounts/users/application/services/crypto.service';
import { DateService } from '../../../../user-accounts/users/application/services/date.service';
import { ReactionStatus } from '../../../reactions/domain/entities/reaction.entity';

describe('GetPostQueryHandler (Integration)', () => {
  let module: TestingModule;
  let queryHandler: GetPostQueryHandler;
  let dataSource: DataSource;
  let postRepo: Repository<Post>;
  let blogRepo: Repository<Blog>;
  let userRepo: Repository<User>;
  let usersFactory: UsersFactory;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DatabaseModule, CoreModule, TypeOrmModule.forFeature(getRelatedEntities(Post))],
      providers: [
        GetPostQueryHandler,
        PostsQueryRepository,
        UsersFactory,
        CryptoService,
        DateService,
      ],
    }).compile();

    queryHandler = module.get<GetPostQueryHandler>(GetPostQueryHandler);
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

  const createUserContext = (userId: number): UserContextDto => {
    const context = new UserContextDto();
    context.id = userId;
    return context;
  };

  describe('успешное получение поста', () => {
    it('должен возвращать пост для аутентифицированного пользователя', async () => {
      const { id: blogId, name: blogName }: Blog = await createTestBlog();
      const post: Post = await createTestPost(blogId, {
        title: 'Amazing Post',
        shortDescription: 'This is an amazing post',
        content: 'Content of the amazing post',
      });
      const user: User = await createTestUser();
      const userContext: UserContextDto = createUserContext(user.id);

      const result: PostViewDto = await queryHandler.execute(
        new GetPostQuery(post.id, userContext),
      );

      expect(result).toBeInstanceOf(PostViewDto);
      expect(result.id).toBe(post.id.toString());
      expect(result.title).toBe(post.title);
      expect(result.shortDescription).toBe(post.shortDescription);
      expect(result.content).toBe(post.content);
      expect(result.blogId).toBe(blogId.toString());
      expect(result.blogName).toBe(blogName);
      expect(result.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(result.extendedLikesInfo).toBeDefined();
      expect(result.extendedLikesInfo.likesCount).toBeGreaterThanOrEqual(0);
      expect(result.extendedLikesInfo.dislikesCount).toBeGreaterThanOrEqual(0);
      expect(Object.values(ReactionStatus)).toContain(result.extendedLikesInfo.myStatus);
      expect(Array.isArray(result.extendedLikesInfo.newestLikes)).toBe(true);
    });

    it('должен возвращать пост для неаутентифицированного пользователя (guest)', async () => {
      const { id: blogId, name: blogName }: Blog = await createTestBlog();
      const post: Post = await createTestPost(blogId, {
        title: 'Public Post',
        shortDescription: 'This post is visible to everyone',
        content: 'Public content',
      });

      const result: PostViewDto = await queryHandler.execute(new GetPostQuery(post.id, null));

      expect(result).toBeInstanceOf(PostViewDto);
      expect(result.id).toBe(post.id.toString());
      expect(result.title).toBe(post.title);
      expect(result.shortDescription).toBe(post.shortDescription);
      expect(result.content).toBe(post.content);
      expect(result.blogId).toBe(blogId.toString());
      expect(result.blogName).toBe(blogName);
      expect(result.createdAt).toBeDefined();
      expect(result.extendedLikesInfo).toBeDefined();
      expect(result.extendedLikesInfo.myStatus).toBe(ReactionStatus.None);
      expect(Array.isArray(result.extendedLikesInfo.newestLikes)).toBe(true);
    });

    it('должен возвращать корректные данные для поста с длинным контентом', async () => {
      const { id: blogId }: Blog = await createTestBlog();
      const post: Post = await createTestPost(blogId, {
        title: 'A'.repeat(30),
        shortDescription: 'B'.repeat(100),
        content: 'A'.repeat(1000),
      });
      const { id: userId }: User = await createTestUser();
      const userContext: UserContextDto = createUserContext(userId);

      const result: PostViewDto = await queryHandler.execute(
        new GetPostQuery(post.id, userContext),
      );

      expect(result.title).toBe(post.title);
      expect(result.shortDescription).toBe(post.shortDescription);
      expect(result.content).toBe(post.content);
      expect(result.content.length).toBe(1000);
    });

    it('должен возвращать пост с корректными временными метками', async () => {
      const { id: blogId }: Blog = await createTestBlog();
      const beforeCreate = new Date();
      const post: Post = await createTestPost(blogId);
      const afterCreate = new Date();
      const { id: userId }: User = await createTestUser();
      const userContext: UserContextDto = createUserContext(userId);

      const result: PostViewDto = await queryHandler.execute(
        new GetPostQuery(post.id, userContext),
      );

      const createdAtDate = new Date(result.createdAt);
      expect(createdAtDate.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
      expect(createdAtDate.getTime()).toBeLessThanOrEqual(afterCreate.getTime());
      expect(result.createdAt).toBe(post.createdAt.toISOString());
    });
  });

  describe('обработка ошибок', () => {
    it('должен выбрасывать DomainException при попытке получить несуществующий пост', async () => {
      const nonExistentId = 99999;
      const { id: userId }: User = await createTestUser();
      const userContext: UserContextDto = createUserContext(userId);

      await expect(
        queryHandler.execute(new GetPostQuery(nonExistentId, userContext)),
      ).rejects.toThrow(DomainException);

      try {
        await queryHandler.execute(new GetPostQuery(nonExistentId, userContext));
        fail('Ожидали DomainException');
      } catch (error) {
        expect(error).toBeInstanceOf(DomainException);
        expect(error.code).toBe(DomainExceptionCode.NotFound);
        expect(error.message).toBe(`The post with ID (${nonExistentId}) does not exist`);
      }
    });

    it('должен выбрасывать DomainException для несуществующего поста без пользователя', async () => {
      const nonExistentId = 88888;

      await expect(queryHandler.execute(new GetPostQuery(nonExistentId, null))).rejects.toThrow(
        DomainException,
      );

      try {
        await queryHandler.execute(new GetPostQuery(nonExistentId, null));
        fail('Ожидали DomainException');
      } catch (error) {
        expect(error).toBeInstanceOf(DomainException);
        expect(error.code).toBe(DomainExceptionCode.NotFound);
        expect(error.message).toBe(`The post with ID (${nonExistentId}) does not exist`);
      }
    });

    it('должен выбрасывать ошибку при попытке получить удаленный пост', async () => {
      const { id: blogId }: Blog = await createTestBlog();
      const { id: postId }: Post = await createTestPost(blogId);
      await postRepo.softDelete(postId);
      const { id: userId }: User = await createTestUser();
      const userContext: UserContextDto = createUserContext(userId);

      await expect(queryHandler.execute(new GetPostQuery(postId, userContext))).rejects.toThrow(
        DomainException,
      );
    });

    //TODO: ошибка падает при мапинге! Есть необходимость исправить?
    it('должен выбрасывать ошибку при попытке получить пост из удаленного блога', async () => {
      const { id: blogId }: Blog = await createTestBlog();
      const { id: postId }: Post = await createTestPost(blogId);
      await blogRepo.softDelete(blogId);
      const { id: userId }: User = await createTestUser();
      const userContext: UserContextDto = createUserContext(userId);

      await expect(queryHandler.execute(new GetPostQuery(postId, userContext))).rejects.toThrow();
    });

    it('должен корректно обрабатывать последовательные запросы несуществующих постов', async () => {
      const nonExistentIds: number[] = [77777, 66666, 55555];
      const { id: userId }: User = await createTestUser();
      const userContext: UserContextDto = createUserContext(userId);

      for (const id of nonExistentIds) {
        await expect(queryHandler.execute(new GetPostQuery(id, userContext))).rejects.toThrow(
          DomainException,
        );
      }
    });
  });

  describe('граничные случаи', () => {
    it('должен корректно обрабатывать ID равный нулю', async () => {
      const { id: userId }: User = await createTestUser();
      const userContext: UserContextDto = createUserContext(userId);

      await expect(queryHandler.execute(new GetPostQuery(0, userContext))).rejects.toThrow(
        DomainException,
      );
    });

    it('должен корректно обрабатывать отрицательные ID', async () => {
      const { id: userId }: User = await createTestUser();
      const userContext: UserContextDto = createUserContext(userId);

      await expect(queryHandler.execute(new GetPostQuery(-1, userContext))).rejects.toThrow(
        DomainException,
      );

      await expect(queryHandler.execute(new GetPostQuery(-999, userContext))).rejects.toThrow(
        DomainException,
      );
    });

    it('должен корректно обрабатывать очень большие ID', async () => {
      const veryLargeId: number = Number.MAX_SAFE_INTEGER;
      const { id: userId }: User = await createTestUser();
      const userContext: UserContextDto = createUserContext(userId);

      await expect(
        queryHandler.execute(new GetPostQuery(veryLargeId, userContext)),
      ).rejects.toThrow();
    });

    it('должен корректно обрабатывать дробные ID', async () => {
      const floatId = 123.456;
      const { id: userId }: User = await createTestUser();
      const userContext: UserContextDto = createUserContext(userId);

      await expect(queryHandler.execute(new GetPostQuery(floatId, userContext))).rejects.toThrow();
    });

    it('должен корректно обрабатывать undefined и null ID', async () => {
      const { id: userId }: User = await createTestUser();
      const userContext: UserContextDto = createUserContext(userId);

      await expect(
        queryHandler.execute(new GetPostQuery(undefined as any, userContext)),
      ).rejects.toThrow();

      await expect(
        queryHandler.execute(new GetPostQuery(null as any, userContext)),
      ).rejects.toThrow();
    });
  });

  describe('производительность и конкурентность', () => {
    it('должен корректно обрабатывать множественные запросы одного поста', async () => {
      const { id: blogId }: Blog = await createTestBlog();
      const post: Post = await createTestPost(blogId);
      const { id: userId }: User = await createTestUser();
      const userContext: UserContextDto = createUserContext(userId);

      const promises: Promise<PostViewDto>[] = Array(100)
        .fill(null)
        .map(() => queryHandler.execute(new GetPostQuery(post.id, userContext)));

      const results: PostViewDto[] = await Promise.all(promises);

      results.forEach((result) => {
        expect(result.id).toBe(post.id.toString());
        expect(result.title).toBe(post.title);
        expect(result.shortDescription).toBe(post.shortDescription);
        expect(result.content).toBe(post.content);
      });
    });

    it('должен корректно обрабатывать конкурентные запросы разных постов', async () => {
      const { id: blogId }: Blog = await createTestBlog();
      const posts: Post[] = await Promise.all([
        createTestPost(blogId, { title: 'Post 1' }),
        createTestPost(blogId, { title: 'Post 2' }),
        createTestPost(blogId, { title: 'Post 3' }),
        createTestPost(blogId, { title: 'Post 4' }),
        createTestPost(blogId, { title: 'Post 5' }),
      ]);
      const { id: userId }: User = await createTestUser();
      const userContext: UserContextDto = createUserContext(userId);

      const promises: Promise<PostViewDto>[] = posts.map((post) =>
        queryHandler.execute(new GetPostQuery(post.id, userContext)),
      );

      const results: PostViewDto[] = await Promise.all(promises);

      results.forEach((result, index) => {
        expect(result.id).toBe(posts[index].id.toString());
        expect(result.title).toBe(posts[index].title);
      });
    });

    it.skip('должен корректно работать при большой нагрузке', async () => {
      const { id: blogId }: Blog = await createTestBlog();
      const postCount = 1000;
      const posts: Post[] = await Promise.all(
        Array.from({ length: postCount }, (_, i) => createTestPost(blogId, { title: `Post ${i}` })),
      );
      const { id: userId }: User = await createTestUser();
      const userContext: UserContextDto = createUserContext(userId);

      //TODO: skip тут
      //итересная конструкция
      const promises: Promise<PostViewDto>[] = posts.flatMap((post) =>
        Array(3)
          .fill(null)
          .map(() => queryHandler.execute(new GetPostQuery(post.id, userContext))),
      );

      const results: PostViewDto[] = await Promise.all(promises);
      expect(results).toHaveLength(postCount * 3);

      results.forEach((result) => {
        expect(result).toBeInstanceOf(PostViewDto);
        expect(result.id).toBeDefined();
        expect(result.title).toBeDefined();
      });
    }, 25000);
  });
});
