import { Test, TestingModule } from '@nestjs/testing';
import { DeleteBlogCommand, DeleteBlogUseCase } from './delete-blog.usecase';
import { Blog } from '../../domain/entities/blog.entity';
import { DataSource, Repository } from 'typeorm';
import { DatabaseModule } from '../../../../database/database.module';
import { CoreModule } from '../../../../../core/core.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Post } from '../../../posts/domain/entities/post.entity';
import { BlogInputDto } from '../../api/input-dto/blog.input-dto';
import { BlogsRepository } from '../../infrastructure/blogs.repository';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';

describe('DeleteBlogUseCase (Integration)', () => {
  let module: TestingModule;
  let useCase: DeleteBlogUseCase;
  let dataSource: DataSource;
  let blogRepo: Repository<Blog>;
  let blogsRepository: BlogsRepository;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DatabaseModule, CoreModule, TypeOrmModule.forFeature([Blog, Post])],
      providers: [DeleteBlogUseCase, BlogsRepository],
    }).compile();

    useCase = module.get<DeleteBlogUseCase>(DeleteBlogUseCase);
    dataSource = module.get<DataSource>(DataSource);
    blogsRepository = module.get<BlogsRepository>(BlogsRepository);
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

  describe('успешное удаление блога', () => {
    it('должен выполнить soft delete существующего блога', async () => {
      const { id: blogId }: Blog = await createTestBlog();

      const blogBeforeDelete: Blog | null = await blogRepo.findOneBy({ id: blogId });
      expect(blogBeforeDelete).toBeDefined();
      expect(blogBeforeDelete).not.toBeNull();
      expect(blogBeforeDelete!.deletedAt).toBeNull();

      await useCase.execute(new DeleteBlogCommand(blogId));

      const blogAfterDelete: Blog | null = await blogRepo
        .createQueryBuilder('blog')
        .withDeleted()
        .where('blog.id = :id', { id: blogId })
        .getOne();

      expect(blogAfterDelete).toBeDefined();
      expect(blogAfterDelete).not.toBeNull();
      expect(blogAfterDelete!.deletedAt).not.toBeNull();
      expect(blogAfterDelete!.deletedAt).toBeInstanceOf(Date);

      const blogNormalFind: Blog | null = await blogRepo.findOneBy({ id: blogId });
      expect(blogNormalFind).toBeNull();
    });

    it('должен корректно обрабатывать временные метки при soft delete', async () => {
      const { id: blogId }: Blog = await createTestBlog();

      const beforeDelete: number = Date.now();

      await useCase.execute(new DeleteBlogCommand(blogId));

      const afterDelete: number = Date.now();

      const deletedBlog: Blog | null = await blogRepo
        .createQueryBuilder('blog')
        .withDeleted()
        .where('blog.id = :id', { id: blogId })
        .getOne();

      expect(deletedBlog).toBeDefined();
      expect(deletedBlog).not.toBeNull();
      expect(deletedBlog!.deletedAt).not.toBeNull();
      expect(deletedBlog!.deletedAt).toBeInstanceOf(Date);

      expect(deletedBlog!.deletedAt!.getTime()).toBeGreaterThanOrEqual(beforeDelete);
      expect(deletedBlog!.deletedAt!.getTime()).toBeLessThanOrEqual(afterDelete);
    });

    it('должен сохранить все данные блога после soft delete', async () => {
      const blogData = {
        name: 'Important Blog',
        description: 'This blog contains important information',
        websiteUrl: 'https://important.example.com',
      };
      const { id: blogId }: Blog = await createTestBlog(blogData);

      await useCase.execute(new DeleteBlogCommand(blogId));

      const deletedBlog: Blog | null = await blogRepo
        .createQueryBuilder('blog')
        .withDeleted()
        .where('blog.id = :id', { id: blogId })
        .getOne();

      expect(deletedBlog).toBeDefined();
      expect(deletedBlog).not.toBeNull();
      expect(deletedBlog!.name).toBe(blogData.name);
      expect(deletedBlog!.description).toBe(blogData.description);
      expect(deletedBlog!.websiteUrl).toBe(blogData.websiteUrl);
      expect(deletedBlog!.isMembership).toBe(false);

      expect(deletedBlog!.deletedAt).not.toBeNull();
      expect(deletedBlog!.deletedAt).toBeInstanceOf(Date);
    });

    it('должен корректно удалять разные блоги по очереди', async () => {
      const blog1: Blog = await createTestBlog({ name: 'Blog One' });
      const blog2: Blog = await createTestBlog({ name: 'Blog Two' });
      const blog3: Blog = await createTestBlog({ name: 'Blog Three' });

      await useCase.execute(new DeleteBlogCommand(blog1.id));
      await useCase.execute(new DeleteBlogCommand(blog3.id));

      const activeBlogsCount: number = await blogRepo.count();
      expect(activeBlogsCount).toBe(1);

      const deletedBlogsCount: number = await blogRepo
        .createQueryBuilder('blog')
        .withDeleted()
        .where('blog.deletedAt IS NOT NULL')
        .getCount();
      expect(deletedBlogsCount).toBe(2);

      const activeBlog: Blog | null = await blogRepo.findOneBy({ id: blog2.id });
      expect(activeBlog).toBeDefined();
      expect(activeBlog).not.toBeNull();
      expect(activeBlog!.name).toBe('Blog Two');
    });
  });

  describe('обработка ошибок', () => {
    it('должен выбрасывать DomainException при попытке удалить несуществующий блог', async () => {
      const nonExistentId = 99999;

      await expect(useCase.execute(new DeleteBlogCommand(nonExistentId))).rejects.toThrow(
        DomainException,
      );
    });

    it('должен выбрасывать DomainException с правильным кодом NotFound', async () => {
      const nonExistentId = 88888;

      try {
        await useCase.execute(new DeleteBlogCommand(nonExistentId));
        fail('Ожидали DomainException');
      } catch (error) {
        expect(error).toBeInstanceOf(DomainException);
        expect(error.code).toBe(DomainExceptionCode.NotFound);
        expect(error.message).toContain(`The blog with ID (${nonExistentId}) does not exist`);
        expect(error.extensions).toBeDefined();
        expect(Array.isArray(error.extensions)).toBe(true);
      }
    });

    it('должен выбрасывать ошибку при попытке удалить уже удаленный блог', async () => {
      const { id: blogId }: Blog = await createTestBlog();

      await useCase.execute(new DeleteBlogCommand(blogId));

      await expect(useCase.execute(new DeleteBlogCommand(blogId))).rejects.toThrow(DomainException);
    });

    it('должен корректно обрабатывать несколько последовательных попыток удаления несуществующего блога', async () => {
      const nonExistentId = 77777;

      for (let i = 0; i < 3; i++) {
        await expect(useCase.execute(new DeleteBlogCommand(nonExistentId))).rejects.toThrow(
          DomainException,
        );
      }
    });
  });

  describe('граничные случаи', () => {
    it('должен корректно обрабатывать ID равный нулю', async () => {
      await expect(useCase.execute(new DeleteBlogCommand(0))).rejects.toThrow(DomainException);
    });

    it('должен корректно обрабатывать отрицательные ID', async () => {
      await expect(useCase.execute(new DeleteBlogCommand(-1))).rejects.toThrow(DomainException);

      await expect(useCase.execute(new DeleteBlogCommand(-999))).rejects.toThrow(DomainException);
    });

    it('должен корректно обрабатывать очень большие ID', async () => {
      const veryLargeId: number = Number.MAX_SAFE_INTEGER;

      await expect(useCase.execute(new DeleteBlogCommand(veryLargeId))).rejects.toThrow();
    });

    it('должен корректно обрабатывать дробные ID', async () => {
      const floatId = 123.456;

      await expect(useCase.execute(new DeleteBlogCommand(floatId))).rejects.toThrow();
    });
  });

  describe('конкурентность и производительность', () => {
    it('должен корректно обрабатывать конкурентные удаления разных блогов', async () => {
      const blogs: Blog[] = await Promise.all([
        createTestBlog({ name: 'ConcurrentBlog1' }),
        createTestBlog({ name: 'ConcurrentBlog2' }),
        createTestBlog({ name: 'ConcurrentBlog3' }),
        createTestBlog({ name: 'ConcurrentBlog4' }),
        createTestBlog({ name: 'ConcurrentBlog5' }),
      ]);

      const deletePromises = blogs.map((blog) => useCase.execute(new DeleteBlogCommand(blog.id)));

      await expect(Promise.all(deletePromises)).resolves.not.toThrow();

      const activeBlogsCount: number = await blogRepo.count();
      expect(activeBlogsCount).toBe(0);

      const deletedBlogsCount: number = await blogRepo
        .createQueryBuilder('blog')
        .withDeleted()
        .where('blog.deletedAt IS NOT NULL')
        .getCount();
      expect(deletedBlogsCount).toBe(5);
    });

    it('должен корректно обрабатывать множественные попытки удаления одного блога', async () => {
      const { id: blogId }: Blog = await createTestBlog();

      const deletePromises = Array(5)
        .fill(null)
        .map(() => useCase.execute(new DeleteBlogCommand(blogId)));

      await Promise.allSettled(deletePromises);

      const deletedBlog: Blog | null = await blogRepo
        .createQueryBuilder('blog')
        .withDeleted()
        .where('blog.id = :id', { id: blogId })
        .getOne();
      expect(deletedBlog!.deletedAt).not.toBeNull();
    });
  });

  describe('интеграция с repository', () => {
    it('должен правильно вызывать методы repository в нужном порядке', async () => {
      const { id: blogId }: Blog = await createTestBlog();

      const getByIdSpy = jest.spyOn(blogsRepository, 'getById');
      const softDeleteSpy = jest.spyOn(blogsRepository, 'softDelete');

      await useCase.execute(new DeleteBlogCommand(blogId));

      expect(getByIdSpy).toHaveBeenCalledWith(blogId);
      expect(getByIdSpy).toHaveBeenCalledTimes(1);
      expect(softDeleteSpy).toHaveBeenCalledWith(blogId);
      expect(softDeleteSpy).toHaveBeenCalledTimes(1);

      const getByIdCall = getByIdSpy.mock.invocationCallOrder[0];
      const softDeleteCall = softDeleteSpy.mock.invocationCallOrder[0];
      expect(getByIdCall).toBeLessThan(softDeleteCall);

      getByIdSpy.mockRestore();
      softDeleteSpy.mockRestore();
    });

    it('не должен вызывать softDelete если блог не найден', async () => {
      const nonExistentId = 99999;
      const softDeleteSpy = jest.spyOn(blogsRepository, 'softDelete');

      await expect(useCase.execute(new DeleteBlogCommand(nonExistentId))).rejects.toThrow(
        DomainException,
      );

      expect(softDeleteSpy).not.toHaveBeenCalled();

      softDeleteSpy.mockRestore();
    });
  });
});
