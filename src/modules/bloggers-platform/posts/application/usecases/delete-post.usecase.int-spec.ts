import { Test, TestingModule } from '@nestjs/testing';
import { DeletePostCommand, DeletePostUseCase } from './delete-post.usecase';
import { DataSource, Repository } from 'typeorm';
import { Post } from '../../domain/entities/post.entity';
import { Blog } from '../../../blogs/domain/entities/blog.entity';
import { PostsRepository } from '../../infrastructure/posts.repository';
import { BlogsRepository } from '../../../blogs/infrastructure/blogs.repository';
import { DatabaseModule } from '../../../../database/database.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getRelatedEntities } from '../../../../../core/utils/get-related-entities.utility';
import { BlogInputDto } from '../../../blogs/api/input-dto/blog.input-dto';
import { PostInputDto } from '../../api/input-dto/post.input-dto';
import { PostCreateDto } from '../dto/post.create-dto';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';
import { configModule } from '../../../../../dynamic-config.module';
import { TransactionHelper } from '../../../../../trasaction.helper';

describe('DeletePostUseCase (Integration)', () => {
  let module: TestingModule;
  let useCase: DeletePostUseCase;
  let dataSource: DataSource;
  let postRepo: Repository<Post>;
  let blogRepo: Repository<Blog>;
  let postsRepository: PostsRepository;
  let blogsRepository: BlogsRepository;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [configModule, DatabaseModule, TypeOrmModule.forFeature(getRelatedEntities(Post))],
      providers: [DeletePostUseCase, PostsRepository, BlogsRepository, TransactionHelper],
    }).compile();

    useCase = module.get<DeletePostUseCase>(DeletePostUseCase);
    dataSource = module.get<DataSource>(DataSource);
    postsRepository = module.get<PostsRepository>(PostsRepository);
    blogsRepository = module.get<BlogsRepository>(BlogsRepository);
    postRepo = dataSource.getRepository<Post>(Post);
    blogRepo = dataSource.getRepository<Blog>(Blog);
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

  describe('успешное удаление поста', () => {
    it('должен выполнить soft delete существующего поста', async () => {
      const { id: blogId }: Blog = await createTestBlog();
      const { id: postId }: Post = await createTestPost(blogId);

      const postBeforeDelete: Post | null = await postRepo.findOneBy({ id: postId });
      expect(postBeforeDelete).toBeDefined();
      expect(postBeforeDelete).not.toBeNull();
      expect(postBeforeDelete!.deletedAt).toBeNull();

      await useCase.execute(new DeletePostCommand(blogId, postId));

      const postAfterDelete: Post | null = await postRepo
        .createQueryBuilder('post')
        .withDeleted()
        .where('post.id = :id', { id: postId })
        .getOne();

      expect(postAfterDelete).toBeDefined();
      expect(postAfterDelete).not.toBeNull();
      expect(postAfterDelete!.deletedAt).not.toBeNull();
      expect(postAfterDelete!.deletedAt).toBeInstanceOf(Date);

      const postNormalFind: Post | null = await postRepo.findOneBy({ id: postId });
      expect(postNormalFind).toBeNull();
    });

    it('должен корректно обрабатывать временные метки при soft delete', async () => {
      const { id: blogId }: Blog = await createTestBlog();
      const { id: postId }: Post = await createTestPost(blogId);

      const beforeDelete: number = Date.now();

      await useCase.execute(new DeletePostCommand(blogId, postId));

      const afterDelete: number = Date.now();

      const deletedPost: Post | null = await postRepo
        .createQueryBuilder('post')
        .withDeleted()
        .where('post.id = :id', { id: postId })
        .getOne();

      expect(deletedPost).toBeDefined();
      expect(deletedPost).not.toBeNull();
      expect(deletedPost!.deletedAt).not.toBeNull();
      expect(deletedPost!.deletedAt).toBeInstanceOf(Date);

      expect(deletedPost!.deletedAt!.getTime()).toBeGreaterThanOrEqual(beforeDelete);
      expect(deletedPost!.deletedAt!.getTime()).toBeLessThanOrEqual(afterDelete);
    });

    it('должен сохранить все данные поста после soft delete', async () => {
      const { id: blogId }: Blog = await createTestBlog();

      const postData: PostInputDto = {
        title: 'Test Post',
        shortDescription: 'Test post short description',
        content: 'Test post content',
      };

      const { id: postId }: Post = await createTestPost(blogId, postData);

      await useCase.execute(new DeletePostCommand(blogId, postId));

      const deletedPost: Post | null = await postRepo
        .createQueryBuilder('post')
        .withDeleted()
        .where('post.id = :id', { id: postId })
        .getOne();

      expect(deletedPost).toBeDefined();
      expect(deletedPost).not.toBeNull();
      expect(deletedPost!.title).toBe(postData.title);
      expect(deletedPost!.shortDescription).toBe(postData.shortDescription);
      expect(deletedPost!.content).toBe(postData.content);
      expect(deletedPost!.blogId).toBe(blogId);

      expect(deletedPost!.deletedAt).not.toBeNull();
      expect(deletedPost!.deletedAt).toBeInstanceOf(Date);
    });

    it('должен корректно удалять разные посты по очереди', async () => {
      const { id: blogId }: Blog = await createTestBlog();
      const { id: postId_1 }: Post = await createTestPost(blogId);
      const { id: postId_2 }: Post = await createTestPost(blogId);
      const { id: postId_3 }: Post = await createTestPost(blogId);

      await useCase.execute(new DeletePostCommand(blogId, postId_1));
      await useCase.execute(new DeletePostCommand(blogId, postId_3));

      const activeCount: number = await postRepo.count();
      expect(activeCount).toBe(1);

      const deletedCount: number = await postRepo
        .createQueryBuilder('post')
        .withDeleted()
        .where('post.deletedAt IS NOT NULL')
        .getCount();
      expect(deletedCount).toBe(2);

      const active: Post | null = await postRepo.findOneBy({ id: postId_2 });
      expect(active).toBeDefined();
      expect(active).not.toBeNull();
      expect(active!.id).toBe(postId_2);
    });
  });

  describe('обработка ошибок', () => {
    it('должен выбрасывать DomainException если блог не существует', async () => {
      const nonExistentBlogId = 99999;

      await expect(useCase.execute(new DeletePostCommand(nonExistentBlogId, 1))).rejects.toThrow(
        DomainException,
      );
    });

    it('должен выбрасывать DomainException с правильным кодом NotFound если блог не существует', async () => {
      const nonExistentBlogId = 88888;

      try {
        await useCase.execute(new DeletePostCommand(nonExistentBlogId, 1));
        fail('Ожидали DomainException');
      } catch (error) {
        expect(error).toBeInstanceOf(DomainException);
        expect(error.code).toBe(DomainExceptionCode.NotFound);
        expect(error.message).toContain(`The blog with ID (${nonExistentBlogId}) does not exist`);
        expect(error.extensions).toBeDefined();
        expect(Array.isArray(error.extensions)).toBe(true);
      }
    });

    it('должен выбрасывать DomainException если пост не существует', async () => {
      const { id: blogId }: Blog = await createTestBlog();
      const nonExistentPostId = 77777;

      await expect(
        useCase.execute(new DeletePostCommand(blogId, nonExistentPostId)),
      ).rejects.toThrow(DomainException);
    });

    it('должен выбрасывать DomainException с правильным кодом NotFound если пост не существует', async () => {
      const { id: blogId }: Blog = await createTestBlog();
      const nonExistentPostId = 77777;

      try {
        await useCase.execute(new DeletePostCommand(blogId, nonExistentPostId));
        fail('Ожидали DomainException');
      } catch (error) {
        expect(error).toBeInstanceOf(DomainException);
        expect(error.code).toBe(DomainExceptionCode.NotFound);
        expect(error.message).toContain(`The post with ID (${nonExistentPostId}) does not exist`);
        expect(error.extensions).toBeDefined();
        expect(Array.isArray(error.extensions)).toBe(true);
      }
    });

    it('должен выбрасывать Forbidden если пост не принадлежит блогу', async () => {
      const { id: blogId_1 }: Blog = await createTestBlog();
      const { id: blogId_2 }: Blog = await createTestBlog();
      const { id: postId_1 }: Post = await createTestPost(blogId_1);
      const { id: postId_2 }: Post = await createTestPost(blogId_2);

      try {
        await useCase.execute(new DeletePostCommand(blogId_1, postId_2));
        fail('Ожидали DomainException');
      } catch (error) {
        expect(error).toBeInstanceOf(DomainException);
        expect(error.code).toBe(DomainExceptionCode.Forbidden);
        expect(error.message).toContain(
          `The post with the ID (${postId_2}) does not belong to the blog with the ID (${blogId_1})`,
        );
        expect(error.extensions).toBeDefined();
        expect(Array.isArray(error.extensions)).toBe(true);
      }

      try {
        await useCase.execute(new DeletePostCommand(blogId_2, postId_1));
        fail('Ожидали DomainException');
      } catch (error) {
        expect(error).toBeInstanceOf(DomainException);
        expect(error.code).toBe(DomainExceptionCode.Forbidden);
        expect(error.message).toContain(
          `The post with the ID (${postId_1}) does not belong to the blog with the ID (${blogId_2})`,
        );
        expect(error.extensions).toBeDefined();
        expect(Array.isArray(error.extensions)).toBe(true);
      }
    });

    it('должен выбрасывать ошибку при попытке удалить уже удаленный пост', async () => {
      const { id: blogId }: Blog = await createTestBlog();
      const { id: postId }: Post = await createTestPost(blogId);

      await useCase.execute(new DeletePostCommand(blogId, postId));

      await expect(useCase.execute(new DeletePostCommand(blogId, postId))).rejects.toThrow(
        DomainException,
      );
    });

    it('должен корректно обрабатывать несколько последовательных попыток удаления несуществующего блога', async () => {
      const nonExistentBlogId = 88888;

      for (let i = 0; i < 3; i++) {
        await expect(useCase.execute(new DeletePostCommand(nonExistentBlogId, 1))).rejects.toThrow(
          DomainException,
        );
      }
    });

    it('должен корректно обрабатывать несколько последовательных попыток удаления несуществующего поста', async () => {
      const { id: blogId }: Blog = await createTestBlog();
      const nonExistentPostId = 77777;

      for (let i = 0; i < 3; i++) {
        await expect(
          useCase.execute(new DeletePostCommand(blogId, nonExistentPostId)),
        ).rejects.toThrow(DomainException);
      }
    });
  });

  describe('граничные случаи', () => {
    it('должен корректно обрабатывать ID равный нулю', async () => {
      const { id: blogId }: Blog = await createTestBlog();

      await expect(useCase.execute(new DeletePostCommand(0, 1))).rejects.toThrow(DomainException);
      await expect(useCase.execute(new DeletePostCommand(blogId, 0))).rejects.toThrow(
        DomainException,
      );
    });

    it('должен корректно обрабатывать отрицательные ID', async () => {
      const { id: blogId }: Blog = await createTestBlog();

      await expect(useCase.execute(new DeletePostCommand(-1, 1))).rejects.toThrow(DomainException);
      await expect(useCase.execute(new DeletePostCommand(-999, 1))).rejects.toThrow(
        DomainException,
      );

      await expect(useCase.execute(new DeletePostCommand(blogId, -1))).rejects.toThrow(
        DomainException,
      );
      await expect(useCase.execute(new DeletePostCommand(blogId, -999))).rejects.toThrow(
        DomainException,
      );
    });

    it('должен корректно обрабатывать очень большие ID', async () => {
      const { id: blogId }: Blog = await createTestBlog();
      const veryLargeId: number = Number.MAX_SAFE_INTEGER;

      await expect(useCase.execute(new DeletePostCommand(veryLargeId, 1))).rejects.toThrow();
      await expect(useCase.execute(new DeletePostCommand(blogId, veryLargeId))).rejects.toThrow();
    });

    it('должен корректно обрабатывать дробные ID', async () => {
      const { id: blogId }: Blog = await createTestBlog();
      const floatId = 123.456;

      await expect(useCase.execute(new DeletePostCommand(floatId, 1))).rejects.toThrow();
      await expect(useCase.execute(new DeletePostCommand(blogId, floatId))).rejects.toThrow();
    });
  });

  describe('конкурентность и производительность', () => {
    it('должен корректно обрабатывать конкурентные удаления разных постов', async () => {
      const { id: blogId } = await createTestBlog();

      const posts: Post[] = await Promise.all([
        createTestPost(blogId, { title: 'ConcurrentBlog1' }),
        createTestPost(blogId, { title: 'ConcurrentBlog2' }),
        createTestPost(blogId, { title: 'ConcurrentBlog3' }),
        createTestPost(blogId, { title: 'ConcurrentBlog4' }),
        createTestPost(blogId, { title: 'ConcurrentBlog5' }),
      ]);

      const deletePromises = posts.map((post) =>
        useCase.execute(new DeletePostCommand(blogId, post.id)),
      );
      await expect(Promise.all(deletePromises)).resolves.not.toThrow();

      const activePostsCount: number = await postRepo.count();
      expect(activePostsCount).toBe(0);

      const deletedPostsCount: number = await postRepo
        .createQueryBuilder('post')
        .withDeleted()
        .where('post.deletedAt IS NOT NULL')
        .getCount();
      expect(deletedPostsCount).toBe(5);
    });

    it('должен корректно обрабатывать множественные попытки удаления одного поста', async () => {
      const { id: blogId }: Blog = await createTestBlog();
      const { id: postId }: Post = await createTestPost(blogId);

      const promises = Array(5)
        .fill(null)
        .map(() => useCase.execute(new DeletePostCommand(blogId, postId)));

      await Promise.allSettled(promises);

      const deletedPost: Post | null = await postRepo
        .createQueryBuilder('post')
        .withDeleted()
        .where('post.id = :id', { id: postId })
        .getOne();
      expect(deletedPost!.deletedAt).not.toBeNull();
    });
  });

  describe('интеграция с repository', () => {
    it('должен правильно вызывать методы repository в нужном порядке', async () => {
      const { id: blogId }: Blog = await createTestBlog();
      const { id: postId }: Post = await createTestPost(blogId);

      const getBlogByIdSpy = jest.spyOn(blogsRepository, 'getById');
      const getPostByIdSpy = jest.spyOn(postsRepository, 'getById');
      const softDeleteSpy = jest.spyOn(postsRepository, 'softDelete');

      await useCase.execute(new DeletePostCommand(blogId, postId));

      expect(getBlogByIdSpy).toHaveBeenCalledWith(blogId);
      expect(getBlogByIdSpy).toHaveBeenCalledTimes(1);
      expect(getPostByIdSpy).toHaveBeenCalledWith(postId);
      expect(getPostByIdSpy).toHaveBeenCalledTimes(1);
      expect(softDeleteSpy).toHaveBeenCalledWith(postId);
      expect(softDeleteSpy).toHaveBeenCalledTimes(1);

      const getBlogByIdSpyCall: number = getBlogByIdSpy.mock.invocationCallOrder[0];
      const getPostByIdSpyCall: number = getPostByIdSpy.mock.invocationCallOrder[0];
      const getSoftDeleteSpyCall: number = softDeleteSpy.mock.invocationCallOrder[0];

      expect(getBlogByIdSpyCall).toBeLessThan(getPostByIdSpyCall);
      expect(getBlogByIdSpyCall).toBeLessThan(getSoftDeleteSpyCall);
      expect(getPostByIdSpyCall).toBeLessThan(getSoftDeleteSpyCall);

      getBlogByIdSpy.mockRestore();
      getPostByIdSpy.mockRestore();
      softDeleteSpy.mockRestore();
    });

    it('не вызывает softDelete если проверки не прошли', async () => {
      const { id: blogId }: Blog = await createTestBlog();
      const nonExistentBlogId = 99999;

      const softDeleteSpy = jest.spyOn(postsRepository, 'softDelete');

      await expect(useCase.execute(new DeletePostCommand(nonExistentBlogId, 1))).rejects.toThrow();
      expect(softDeleteSpy).not.toHaveBeenCalled();

      await expect(useCase.execute(new DeletePostCommand(blogId, 1))).rejects.toThrow();
      expect(softDeleteSpy).not.toHaveBeenCalled();

      softDeleteSpy.mockRestore();
    });
  });
});
