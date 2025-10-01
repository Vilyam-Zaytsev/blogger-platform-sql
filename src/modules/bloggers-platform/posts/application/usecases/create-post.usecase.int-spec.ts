import { Test, TestingModule } from '@nestjs/testing';
import { CreatePostCommand, CreatePostUseCase } from './create-post.usecase';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { Blog } from '../../../blogs/domain/entities/blog.entity';
import { Post } from '../../domain/entities/post.entity';
import { DatabaseModule } from '../../../../database/database.module';
import { CoreModule } from '../../../../../core/core.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlogInputDto } from '../../../blogs/api/input-dto/blog.input-dto';
import { PostCreateDto } from '../dto/post.create-dto';
import { BlogsRepository } from '../../../blogs/infrastructure/blogs.repository';
import { PostsRepository } from '../../infrastructure/posts.repository';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';
import { getRelatedEntities } from '../../../../../core/utils/get-related-entities.utility';

describe('CreatePostUseCase (Integration)', () => {
  let module: TestingModule;
  let useCase: CreatePostUseCase;
  let dataSource: DataSource;
  let blogsRepository: BlogsRepository;
  let postsRepository: PostsRepository;
  let blogRepo: Repository<Blog>;
  let postRepo: Repository<Post>;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DatabaseModule, CoreModule, TypeOrmModule.forFeature(getRelatedEntities(Post))],
      providers: [CreatePostUseCase, PostsRepository, BlogsRepository],
    }).compile();

    useCase = module.get<CreatePostUseCase>(CreatePostUseCase);
    dataSource = module.get<DataSource>(DataSource);
    blogsRepository = module.get<BlogsRepository>(BlogsRepository);
    postsRepository = module.get<PostsRepository>(PostsRepository);
    blogRepo = dataSource.getRepository<Blog>(Blog);
    postRepo = dataSource.getRepository<Post>(Post);
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE TABLE blogs RESTART IDENTITY CASCADE');
    await dataSource.query('TRUNCATE TABLE posts RESTART IDENTITY CASCADE');
  });

  afterAll(async () => {
    await dataSource.destroy();
    await module.close();
  });

  const createTestBlog = async (blogData?: Partial<BlogInputDto>): Promise<Blog> => {
    const defaultData: BlogInputDto = {
      name: 'Test Blog',
      description: 'Test blog description for posts',
      websiteUrl: 'https://testblog.example.com',
      ...blogData,
    };

    const blog: Blog = Blog.create(defaultData);
    return await blogRepo.save(blog);
  };

  describe('успешное создание поста', () => {
    it('должен создать пост с валидными данными и вернуть ID', async () => {
      const { id: blogId }: Blog = await createTestBlog();

      const dto: PostCreateDto = {
        title: 'Test Post',
        shortDescription: 'Short description for test post',
        content: 'This is the content of the test post with more details',
        blogId,
      };

      const postId: number = await useCase.execute(new CreatePostCommand(dto));

      expect(postId).toBeDefined();
      expect(typeof postId).toBe('number');
      expect(postId).toBeGreaterThan(0);

      const createdPost: Post | null = await postRepo.findOne({
        where: { id: postId },
        relations: ['blog'],
      });

      if (!createdPost) {
        throw new Error(
          'Тест №1: CreatePostUseCase (Integration): Неудалось найти пост по ID после создания',
        );
      }

      expect(createdPost).toBeDefined();
      expect(createdPost).not.toBeNull();
      expect(createdPost.title).toBe(dto.title);
      expect(createdPost.shortDescription).toBe(dto.shortDescription);
      expect(createdPost.content).toBe(dto.content);
      expect(createdPost.blogId).toBe(dto.blogId);

      expect(createdPost.blog).toBeDefined();
      expect(createdPost.blog.id).toBe(blogId);

      expect(createdPost.createdAt).toBeInstanceOf(Date);
      expect(createdPost.updatedAt).toBeInstanceOf(Date);
      expect(createdPost.deletedAt).toBeNull();
    });

    it('должен создать пост с корректной связью с блогом', async () => {
      const { id: blogId, name }: Blog = await createTestBlog({
        name: 'Tech Blog',
        description: 'Technology and programming articles',
      });

      const dto: PostCreateDto = {
        title: 'JavaScript Tips',
        shortDescription: 'Useful JavaScript programming tips',
        content: 'Here are some useful JavaScript programming tips for developers',
        blogId,
      };

      const postId: number = await useCase.execute(new CreatePostCommand(dto));

      const createdPost: Post | null = await postRepo.findOne({
        where: { id: postId },
        relations: ['blog'],
      });

      expect(createdPost).toBeDefined();
      expect(createdPost).not.toBeNull();
      expect(createdPost!.blog).toBeDefined();
      expect(createdPost!.blog.id).toBe(blogId);
      expect(createdPost!.blogId).toBe(blogId);
      expect(createdPost!.blog.name).toBe(name);

      const blogWithPosts: Blog | null = await blogRepo.findOne({
        where: { id: blogId },
        relations: ['posts'],
      });

      expect(blogWithPosts!.posts).toHaveLength(1);
      expect(blogWithPosts!.posts[0].id).toBe(postId);
    });

    it('должен корректно обрабатывать граничные значения полей', async () => {
      const { id: blogId }: Blog = await createTestBlog();

      // Минимальные значения
      const minDto: PostCreateDto = {
        title: 'A',
        shortDescription: 'B',
        content: 'C',
        blogId,
      };

      const minPostId: number = await useCase.execute(new CreatePostCommand(minDto));

      expect(minPostId).toBeDefined();
      expect(minPostId).toBeGreaterThan(0);

      // Максимальные значения
      const maxDto: PostCreateDto = {
        title: '1'.repeat(30),
        shortDescription: 'A'.repeat(100),
        content: 'B'.repeat(1000),
        blogId,
      };

      const maxPostId: number = await useCase.execute(new CreatePostCommand(maxDto));

      expect(maxPostId).toBeDefined();
      expect(maxPostId).toBeGreaterThan(0);
      expect(maxPostId).not.toBe(minPostId);

      const maxPost: Post | null = await postRepo.findOneBy({ id: maxPostId });
      expect(maxPost!.title).toBe(maxDto.title);
      expect(maxPost!.shortDescription).toBe(maxDto.shortDescription);
      expect(maxPost!.content).toBe(maxDto.content);
    });

    it('должен создавать уникальные посты для каждого вызова', async () => {
      const { id: blogId }: Blog = await createTestBlog();

      const dto1: PostCreateDto = {
        title: 'First Post',
        shortDescription: 'Description for first post',
        content: 'Content of the first post',
        blogId,
      };

      const dto2: PostCreateDto = {
        title: 'Second Post',
        shortDescription: 'Description for second post',
        content: 'Content of the second post',
        blogId,
      };

      const [postId1, postId2] = await Promise.all([
        useCase.execute(new CreatePostCommand(dto1)),
        useCase.execute(new CreatePostCommand(dto2)),
      ]);

      expect(postId1).not.toBe(postId2);

      const postsCount: number = await postRepo.count();
      expect(postsCount).toBe(2);

      const [post1, post2] = await Promise.all([
        postRepo.findOneBy({ id: postId1 }),
        postRepo.findOneBy({ id: postId2 }),
      ]);

      expect(post1!.title).toBe('First Post');
      expect(post2!.title).toBe('Second Post');
    });

    it('должен создавать множественные посты для одного блога', async () => {
      const { id: blogId }: Blog = await createTestBlog({ name: 'Multi Post Blog' });
      const postCount = 50;
      const promises: Promise<number>[] = [];

      for (let i = 0; i < postCount; i++) {
        const dto: PostCreateDto = {
          title: `Post ${i + 1}`,
          shortDescription: `Description ${i + 1}`,
          content: `Content for post number ${i + 1}`,
          blogId,
        };
        promises.push(useCase.execute(new CreatePostCommand(dto)));
      }

      const postIds: number[] = await Promise.all(promises);

      expect(postIds).toHaveLength(postCount);
      expect(new Set(postIds).size).toBe(postCount);

      const totalPosts: number = await postRepo.count();
      expect(totalPosts).toBe(postCount);

      const postsForBlog: Post[] = await postRepo.find({
        where: { blogId },
      });
      expect(postsForBlog).toHaveLength(postCount);
    });

    it('должен корректно обрабатывать временные метки при создании', async () => {
      const { id: blogId }: Blog = await createTestBlog();
      const dto: PostCreateDto = {
        title: 'Timestamp Test',
        shortDescription: 'Testing timestamp creation',
        content: 'This post is for testing timestamp functionality',
        blogId,
      };

      const beforeCreation = new Date();

      const postId: number = await useCase.execute(new CreatePostCommand(dto));

      const afterCreation = new Date();

      const createdPost: Post | null = await postRepo.findOneBy({ id: postId });

      expect(createdPost!.createdAt).toBeInstanceOf(Date);
      expect(createdPost!.updatedAt).toBeInstanceOf(Date);
      expect(createdPost!.deletedAt).toBeNull();

      expect(createdPost!.createdAt.getTime()).toBeGreaterThanOrEqual(beforeCreation.getTime());
      expect(createdPost!.createdAt.getTime()).toBeLessThanOrEqual(afterCreation.getTime());
      expect(createdPost!.updatedAt.getTime()).toBeGreaterThanOrEqual(beforeCreation.getTime());
      expect(createdPost!.updatedAt.getTime()).toBeLessThanOrEqual(afterCreation.getTime());
    });
  });

  describe('обработка ошибок', () => {
    it('должен выбрасывать DomainException при попытке создать пост для несуществующего блога', async () => {
      const nonExistentBlogId = 99999;
      const dto: PostCreateDto = {
        title: 'Orphan Post',
        shortDescription: 'Post without parent blog',
        content: 'This post should not be created',
        blogId: nonExistentBlogId,
      };

      await expect(useCase.execute(new CreatePostCommand(dto))).rejects.toThrow(DomainException);
    });

    it('должен выбрасывать DomainException с правильным кодом NotFound', async () => {
      const nonExistentBlogId = 88888;
      const dto: PostCreateDto = {
        title: 'Test Post',
        shortDescription: 'Test description',
        content: 'Test content',
        blogId: nonExistentBlogId,
      };

      try {
        await useCase.execute(new CreatePostCommand(dto));
        fail('Ожидали DomainException');
      } catch (error) {
        expect(error).toBeInstanceOf(DomainException);
        expect(error.code).toBe(DomainExceptionCode.NotFound);
        expect(error.message).toContain(`The blog with ID (${nonExistentBlogId}) does not exist`);
        expect(error.extensions).toBeDefined();
        expect(Array.isArray(error.extensions)).toBe(true);
      }
    });

    it('должен выбрасывать ошибку при попытке создать пост для удаленного блога', async () => {
      const { id: blogId }: Blog = await createTestBlog();

      await blogRepo.softDelete(blogId);

      const dto: PostCreateDto = {
        title: 'Post for Deleted Blog',
        shortDescription: 'This should fail',
        content: 'Post for deleted blog should not be created',
        blogId: blogId,
      };

      await expect(useCase.execute(new CreatePostCommand(dto))).rejects.toThrow(DomainException);
    });

    it('должен включать правильный blogId в сообщение об ошибке', async () => {
      const testBlogId = 12345;
      const dto: PostCreateDto = {
        title: 'Error Test Post',
        shortDescription: 'Testing error message',
        content: 'This should generate proper error message',
        blogId: testBlogId,
      };

      try {
        await useCase.execute(new CreatePostCommand(dto));
        fail('Ожидали DomainException');
      } catch (error) {
        expect(error).toBeInstanceOf(DomainException);
        expect(error.message).toBe(`The blog with ID (${testBlogId}) does not exist`);
        expect(error.message).toContain(testBlogId.toString());
      }
    });
  });

  describe('валидация данных', () => {
    let blogId: number;

    beforeEach(async () => {
      blogId = (await createTestBlog()).id;
    });

    it('должен отклонять создание поста с пустым title', async () => {
      const dto: PostCreateDto = {
        title: '',
        shortDescription: 'Valid description',
        content: 'Valid content',
        blogId,
      };

      await expect(useCase.execute(new CreatePostCommand(dto))).rejects.toThrow();
    });

    it('должен отклонять создание поста со слишком длинным title', async () => {
      const dto: PostCreateDto = {
        title: 'A'.repeat(31),
        shortDescription: 'Valid description',
        content: 'Valid content',
        blogId,
      };

      await expect(useCase.execute(new CreatePostCommand(dto))).rejects.toThrow();
    });

    it('должен отклонять создание поста с пустым shortDescription', async () => {
      const dto: PostCreateDto = {
        title: 'Valid Title',
        shortDescription: '',
        content: 'Valid content',
        blogId,
      };

      await expect(useCase.execute(new CreatePostCommand(dto))).rejects.toThrow();
    });

    it('должен отклонять создание поста со слишком длинным shortDescription', async () => {
      const dto: PostCreateDto = {
        title: 'Valid Title',
        shortDescription: 'A'.repeat(101),
        content: 'Valid content',
        blogId,
      };

      await expect(useCase.execute(new CreatePostCommand(dto))).rejects.toThrow();
    });

    it('должен отклонять создание поста с пустым content', async () => {
      const dto: PostCreateDto = {
        title: 'Valid Title',
        shortDescription: 'Valid description',
        content: '',
        blogId,
      };

      await expect(useCase.execute(new CreatePostCommand(dto))).rejects.toThrow();
    });

    it('должен отклонять создание поста со слишком длинным content', async () => {
      const dto: PostCreateDto = {
        title: 'Valid Title',
        shortDescription: 'Valid description',
        content: 'A'.repeat(1001),
        blogId,
      };

      await expect(useCase.execute(new CreatePostCommand(dto))).rejects.toThrow();
    });
  });

  describe('граничные случаи', () => {
    it('должен корректно обрабатывать blogId равный нулю', async () => {
      const dto: PostCreateDto = {
        title: 'Test Post',
        shortDescription: 'Test description',
        content: 'Test content',
        blogId: 0,
      };

      await expect(useCase.execute(new CreatePostCommand(dto))).rejects.toThrow(DomainException);
    });

    it('должен корректно обрабатывать отрицательный blogId', async () => {
      const dto: PostCreateDto = {
        title: 'Test Post',
        shortDescription: 'Test description',
        content: 'Test content',
        blogId: -1,
      };

      await expect(useCase.execute(new CreatePostCommand(dto))).rejects.toThrow(DomainException);
    });

    it('должен корректно обрабатывать очень большой blogId', async () => {
      const dto: PostCreateDto = {
        title: 'Test Post',
        shortDescription: 'Test description',
        content: 'Test content',
        blogId: Number.MAX_SAFE_INTEGER,
      };

      await expect(useCase.execute(new CreatePostCommand(dto))).rejects.toThrow(QueryFailedError);
    });

    it('должен корректно обрабатывать дробный blogId', async () => {
      const dto: PostCreateDto = {
        title: 'Test Post',
        shortDescription: 'Test description',
        content: 'Test content',
        blogId: 123.456,
      };

      await expect(useCase.execute(new CreatePostCommand(dto))).rejects.toThrow(QueryFailedError);
    });
  });

  describe('конкурентность и производительность', () => {
    it('должен корректно обрабатывать конкурентное создание постов для разных блогов', async () => {
      const blogs: Blog[] = await Promise.all([
        createTestBlog({ name: 'ConcurrentBlog1' }),
        createTestBlog({ name: 'ConcurrentBlog2' }),
        createTestBlog({ name: 'ConcurrentBlog3' }),
      ]);

      const createPromises: Promise<number>[] = blogs.map((blog, index) => {
        const dto: PostCreateDto = {
          title: `Concurrent Post ${index + 1}`,
          shortDescription: `Description ${index + 1}`,
          content: `Content for concurrent post ${index + 1}`,
          blogId: blog.id,
        };
        return useCase.execute(new CreatePostCommand(dto));
      });

      const postIds: number[] = await Promise.all(createPromises);

      expect(postIds).toHaveLength(3);
      expect(new Set(postIds).size).toBe(3);

      const createdPosts: (Post | null)[] = await Promise.all(
        postIds.map((id) =>
          postRepo.findOne({
            where: { id },
            relations: ['blog'],
          }),
        ),
      );

      createdPosts.forEach((post, index) => {
        expect(post!.title).toBe(`Concurrent Post ${index + 1}`);
        expect(post!.blog.name).toBe(blogs[index].name);
      });
    });

    it('должен корректно обрабатывать создание большого количества постов', async () => {
      const { id: blogId }: Blog = await createTestBlog({ name: 'HighVolumeBlog' });
      const postCount = 1000;
      const promises: Promise<number>[] = [];

      for (let i = 0; i < postCount; i++) {
        const dto: PostCreateDto = {
          title: `Bulk Post ${i + 1}`,
          shortDescription: `Bulk description ${i + 1}`,
          content: `Bulk content for post ${i + 1}`,
          blogId,
        };
        promises.push(useCase.execute(new CreatePostCommand(dto)));
      }

      const startTime: number = Date.now();

      const postIds: number[] = await Promise.all(promises);

      const endTime: number = Date.now();
      const executionTime: number = endTime - startTime;

      expect(postIds).toHaveLength(postCount);
      expect(new Set(postIds).size).toBe(postCount);
      expect(executionTime).toBeLessThan(10000);

      const totalPosts: number = await postRepo.count();
      expect(totalPosts).toBe(postCount);
    }, 10000);
  });

  describe('интеграция с репозиториями', () => {
    it('должен правильно вызывать методы репозиториев в нужном порядке', async () => {
      const { id: blogId }: Blog = await createTestBlog();
      const dto: PostCreateDto = {
        title: 'Integration Test Post',
        shortDescription: 'Testing repository integration',
        content: 'This post tests repository method calls',
        blogId,
      };

      const getBlogByIdSpy = jest.spyOn(blogsRepository, 'getById');
      const savePostSpy = jest.spyOn(postsRepository, 'save');

      const postId: number = await useCase.execute(new CreatePostCommand(dto));

      expect(getBlogByIdSpy).toHaveBeenCalledWith(dto.blogId);
      expect(getBlogByIdSpy).toHaveBeenCalledTimes(1);
      expect(savePostSpy).toHaveBeenCalledTimes(1);

      const getBlogCall: number = getBlogByIdSpy.mock.invocationCallOrder[0];
      const saveCall: number = savePostSpy.mock.invocationCallOrder[0];
      expect(getBlogCall).toBeLessThan(saveCall);

      const saveCallArgs: Post = savePostSpy.mock.calls[0][0];
      expect(saveCallArgs).toBeInstanceOf(Post);
      expect(saveCallArgs.title).toBe(dto.title);
      expect(saveCallArgs.shortDescription).toBe(dto.shortDescription);
      expect(saveCallArgs.content).toBe(dto.content);
      expect(saveCallArgs.blogId).toBe(dto.blogId);

      expect(postId).toBeDefined();

      getBlogByIdSpy.mockRestore();
      savePostSpy.mockRestore();
    });

    it('не должен вызывать save если блог не найден', async () => {
      const nonExistentBlogId = 99999;
      const dto: PostCreateDto = {
        title: 'Test Post',
        shortDescription: 'Test description',
        content: 'Test content',
        blogId: nonExistentBlogId,
      };

      const savePostSpy = jest.spyOn(postsRepository, 'save');

      await expect(useCase.execute(new CreatePostCommand(dto))).rejects.toThrow(DomainException);

      expect(savePostSpy).not.toHaveBeenCalled();

      savePostSpy.mockRestore();
    });

    it('должен правильно создавать Post entity через статический метод create', async () => {
      const { id: blogId }: Blog = await createTestBlog();
      const dto: PostCreateDto = {
        title: 'Entity Creation Test',
        shortDescription: 'Testing Post entity creation',
        content: 'This tests the Post.create static method',
        blogId,
      };

      const postCreateSpy = jest.spyOn(Post, 'create');

      await useCase.execute(new CreatePostCommand(dto));

      expect(postCreateSpy).toHaveBeenCalledWith(dto);
      expect(postCreateSpy).toHaveBeenCalledTimes(1);

      const createdPost = postCreateSpy.mock.results[0].value;
      expect(createdPost).toBeInstanceOf(Post);
      expect(createdPost.title).toBe(dto.title);
      expect(createdPost.shortDescription).toBe(dto.shortDescription);
      expect(createdPost.content).toBe(dto.content);
      expect(createdPost.blogId).toBe(dto.blogId);

      postCreateSpy.mockRestore();
    });
  });
});
