import { Test, TestingModule } from '@nestjs/testing';
import { GetBlogQuery, GetBlogQueryHandler } from './get-blog.query-handler';
import { BlogsQueryRepository } from '../../infrastructure/query/blogs.query-repository';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { Blog } from '../../domain/entities/blog.entity';
import { DatabaseModule } from '../../../../database/database.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlogInputDto } from '../../api/input-dto/blog.input-dto';
import { BlogViewDto } from '../../api/view-dto/blog.view-dto';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';
import { getRelatedEntities } from '../../../../../core/utils/get-related-entities.utility';
import { configModule } from '../../../../../dynamic-config.module';
import { TransactionHelper } from '../../../../database/trasaction.helper';

describe('GetBlogQueryHandler (Integration)', () => {
  let module: TestingModule;
  let queryHandler: GetBlogQueryHandler;
  let blogsQueryRepository: BlogsQueryRepository;
  let dataSource: DataSource;
  let blogRepo: Repository<Blog>;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [configModule, DatabaseModule, TypeOrmModule.forFeature(getRelatedEntities(Blog))],
      providers: [GetBlogQueryHandler, BlogsQueryRepository, TransactionHelper],
    }).compile();

    queryHandler = module.get<GetBlogQueryHandler>(GetBlogQueryHandler);
    blogsQueryRepository = module.get<BlogsQueryRepository>(BlogsQueryRepository);
    dataSource = module.get<DataSource>(DataSource);
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
      description: 'Test blog description for query handler testing',
      websiteUrl: 'https://testblog.example.com',
      ...blogData,
    };

    const blog: Blog = Blog.create(defaultData);
    return await blogRepo.save(blog);
  };

  describe('успешное получение блога', () => {
    it('должен вернуть BlogViewDto для существующего блога', async () => {
      const createdBlog: Blog = await createTestBlog();

      const blog: BlogViewDto = await queryHandler.execute(new GetBlogQuery(createdBlog.id));

      expect(blog).toBeDefined();
      expect(blog).not.toBeNull();
      expect(blog).toBeInstanceOf(BlogViewDto);

      expect(typeof blog.id).toBe('string');
      expect(typeof blog.name).toBe('string');
      expect(typeof blog.description).toBe('string');
      expect(typeof blog.websiteUrl).toBe('string');
      expect(typeof blog.createdAt).toBe('string');
      expect(typeof blog.isMembership).toBe('boolean');

      expect(blog.id).toBe(createdBlog.id.toString());
      expect(blog.name).toBe(createdBlog.name);
      expect(blog.description).toBe(createdBlog.description);
      expect(blog.websiteUrl).toBe(createdBlog.websiteUrl);
      expect(blog.isMembership).toBe(false);

      expect(blog.createdAt).toBe(createdBlog.createdAt.toISOString());
      expect(() => new Date(blog.createdAt)).not.toThrow();
    });

    it('должен корректно преобразовывать все типы данных из entity в DTO', async () => {
      const createdBlog: Blog = await createTestBlog();

      const blog: BlogViewDto = await queryHandler.execute(new GetBlogQuery(createdBlog.id));

      expect(blog.id).toBe(createdBlog.id.toString());
      expect(parseInt(blog.id)).toBe(createdBlog.id);

      expect(blog.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(new Date(blog.createdAt).getTime()).toBe(createdBlog.createdAt.getTime());

      expect(blog.isMembership).toBe(createdBlog.isMembership);

      expect(blog.name).toBe(createdBlog.name);
      expect(blog.description).toBe(createdBlog.description);
      expect(blog.websiteUrl).toBe(createdBlog.websiteUrl);
    });

    it('должен возвращать различные блоги с правильными данными', async () => {
      const blog1: Blog = await createTestBlog({
        name: 'Tech Blog',
        description: 'Technology and programming',
        websiteUrl: 'https://tech.example.com',
      });

      const blog2: Blog = await createTestBlog({
        name: 'Food Blog',
        description: 'Recipes and cooking tips',
        websiteUrl: 'https://food.example.com',
      });

      const [result1, result2] = await Promise.all([
        queryHandler.execute(new GetBlogQuery(blog1.id)),
        queryHandler.execute(new GetBlogQuery(blog2.id)),
      ]);

      expect(result1.id).toBe(blog1.id.toString());
      expect(result1.name).toBe('Tech Blog');
      expect(result1.description).toBe('Technology and programming');
      expect(result1.websiteUrl).toBe('https://tech.example.com');

      expect(result2.id).toBe(blog2.id.toString());
      expect(result2.name).toBe('Food Blog');
      expect(result2.description).toBe('Recipes and cooking tips');
      expect(result2.websiteUrl).toBe('https://food.example.com');

      expect(result1.id).not.toBe(result2.id);
      expect(result1.name).not.toBe(result2.name);
    });

    it('должен возвращать блог с корректными временными метками', async () => {
      const beforeCreation = new Date();
      const createdBlog: Blog = await createTestBlog();
      const afterCreation = new Date();

      const result: BlogViewDto = await queryHandler.execute(new GetBlogQuery(createdBlog.id));

      const createdAtDate = new Date(result.createdAt);

      expect(createdAtDate.getTime()).toBeGreaterThanOrEqual(beforeCreation.getTime());
      expect(createdAtDate.getTime()).toBeLessThanOrEqual(afterCreation.getTime());

      expect(result.createdAt).toBe(createdBlog.createdAt.toISOString());
    });

    it('должен корректно обрабатывать блоги с граничными значениями полей', async () => {
      // блог с минимальными значениями
      const minBlog: Blog = await createTestBlog({
        name: 'A',
        description: 'B',
        websiteUrl: 'https://a.co',
      });

      // блог с максимальными значениями
      const maxBlog: Blog = await createTestBlog({
        name: '123456789012345',
        description: 'A'.repeat(500),
        websiteUrl: 'https://' + 'a'.repeat(85) + '.com',
      });

      const [minResult, maxResult] = await Promise.all([
        queryHandler.execute(new GetBlogQuery(minBlog.id)),
        queryHandler.execute(new GetBlogQuery(maxBlog.id)),
      ]);

      expect(minResult.name).toBe(minBlog.name);
      expect(minResult.description).toBe(minBlog.description);
      expect(minResult.websiteUrl).toBe(minBlog.websiteUrl);

      expect(maxResult.name).toBe(maxBlog.name);
      expect(maxResult.description).toBe(maxBlog.description);
      expect(maxResult.websiteUrl).toBe(maxBlog.websiteUrl);
    });
  });

  describe('обработка ошибок', () => {
    it('должен выбрасывать DomainException при запросе несуществующего блога', async () => {
      const nonExistentId = 99999;

      await expect(queryHandler.execute(new GetBlogQuery(nonExistentId))).rejects.toThrow(
        DomainException,
      );
    });

    it('должен выбрасывать DomainException с правильным кодом NotFound', async () => {
      const nonExistentId = 88888;

      try {
        await queryHandler.execute(new GetBlogQuery(nonExistentId));
        fail('Ожидали DomainException');
      } catch (error) {
        expect(error).toBeInstanceOf(DomainException);
        expect(error.code).toBe(DomainExceptionCode.NotFound);
        expect(error.message).toContain(`The blog with ID (${nonExistentId}) does not exist`);
        expect(error.extensions).toBeDefined();
        expect(Array.isArray(error.extensions)).toBe(true);
      }
    });

    it('должен выбрасывать ошибку при запросе удаленного блога (soft deleted)', async () => {
      const { id: blogId }: Blog = await createTestBlog();

      await blogRepo.softDelete(blogId);

      await expect(queryHandler.execute(new GetBlogQuery(blogId))).rejects.toThrow(DomainException);
    });

    it('должен включать правильный ID в сообщение об ошибке', async () => {
      const testId = 12345;

      try {
        await queryHandler.execute(new GetBlogQuery(testId));
        fail('Ожидали DomainException');
      } catch (error) {
        expect(error).toBeInstanceOf(DomainException);
        expect(error.message).toBe(`The blog with ID (${testId}) does not exist`);
        expect(error.message).toContain(testId.toString());
      }
    });

    it('должен корректно обрабатывать несколько последовательных запросов несуществующих блогов', async () => {
      const nonExistentIds: number[] = [77777, 66666, 55555];

      for (const id of nonExistentIds) {
        await expect(queryHandler.execute(new GetBlogQuery(id))).rejects.toThrow(DomainException);
      }
    });
  });

  describe('граничные случаи', () => {
    it('должен корректно обрабатывать ID равный нулю', async () => {
      await expect(queryHandler.execute(new GetBlogQuery(0))).rejects.toThrow(DomainException);
    });

    it('должен корректно обрабатывать отрицательные ID', async () => {
      await expect(queryHandler.execute(new GetBlogQuery(-1))).rejects.toThrow(DomainException);

      await expect(queryHandler.execute(new GetBlogQuery(-999))).rejects.toThrow(DomainException);
    });

    it('должен корректно обрабатывать очень большие ID', async () => {
      const veryLargeId: number = Number.MAX_SAFE_INTEGER;

      await expect(queryHandler.execute(new GetBlogQuery(veryLargeId))).rejects.toThrow(
        QueryFailedError,
      );
    });

    it('должен корректно обрабатывать дробные ID', async () => {
      const floatId = 123.456;

      await expect(queryHandler.execute(new GetBlogQuery(floatId))).rejects.toThrow(
        QueryFailedError,
      );
    });
  });

  describe('производительность и конкурентность', () => {
    it('должен корректно обрабатывать конкурентные запросы разных блогов', async () => {
      const blogs: Blog[] = await Promise.all([
        createTestBlog({ name: 'ConcurrentBlog1' }),
        createTestBlog({ name: 'ConcurrentBlog2' }),
        createTestBlog({ name: 'ConcurrentBlog3' }),
        createTestBlog({ name: 'ConcurrentBlog4' }),
        createTestBlog({ name: 'ConcurrentBlog5' }),
      ]);

      const queryPromises: Promise<BlogViewDto>[] = blogs.map((blog) =>
        queryHandler.execute(new GetBlogQuery(blog.id)),
      );

      const results: BlogViewDto[] = await Promise.all(queryPromises);

      expect(results).toHaveLength(5);

      results.forEach((result, index) => {
        expect(result.id).toBe(blogs[index].id.toString());
        expect(result.name).toBe(`ConcurrentBlog${index + 1}`);
        expect(result).toBeInstanceOf(BlogViewDto);
      });

      const uniqueIds = new Set(results.map((r) => r.id));
      expect(uniqueIds.size).toBe(5);
    });

    it('должен корректно обрабатывать множественные запросы одного и того же блога', async () => {
      const createdBlog: Blog = await createTestBlog({
        name: 'Popular Blog',
        description: 'This blog will be requested multiple times',
        websiteUrl: 'https://popular.example.com',
      });

      const queryPromises: Promise<BlogViewDto>[] = Array(1000)
        .fill(null)
        .map(() => queryHandler.execute(new GetBlogQuery(createdBlog.id)));

      const results: BlogViewDto[] = await Promise.all(queryPromises);

      expect(results).toHaveLength(1000);

      results.forEach((result) => {
        expect(result.id).toBe(createdBlog.id.toString());
        expect(result.name).toBe(createdBlog.name);
        expect(result.description).toBe(createdBlog.description);
        expect(result.websiteUrl).toBe(createdBlog.websiteUrl);
        expect(result).toBeInstanceOf(BlogViewDto);
      });
    });

    it('должен показывать хорошую производительность при запросе большого количества блогов', async () => {
      const blogCount = 1000;
      const blogs: Blog[] = await Promise.all(
        Array(blogCount)
          .fill(null)
          .map((_, index) =>
            createTestBlog({
              name: `Blog_${index}`,
              description: `Description for performance blog ${index}`,
              websiteUrl: `https://performance${index}.example.com`,
            }),
          ),
      );

      const startTime: number = Date.now();

      const results: BlogViewDto[] = await Promise.all(
        blogs.map((blog) => queryHandler.execute(new GetBlogQuery(blog.id))),
      );

      const endTime: number = Date.now();
      const executionTime: number = endTime - startTime;

      expect(results).toHaveLength(blogCount);
      expect(executionTime).toBeLessThan(5000);

      results.forEach((result, index) => {
        expect(result.id).toBe(blogs[index].id.toString());
        expect(result.name).toBe(`Blog_${index}`);
      });
    }, 10000);
  });

  describe('интеграция с repository', () => {
    it('должен правильно вызывать метод blogsQueryRepository', async () => {
      const createdBlog: Blog = await createTestBlog();
      const getByIdSpy = jest.spyOn(blogsQueryRepository, 'getByIdOrNotFoundFail');

      const result: BlogViewDto = await queryHandler.execute(new GetBlogQuery(createdBlog.id));

      expect(getByIdSpy).toHaveBeenCalledWith(createdBlog.id);
      expect(getByIdSpy).toHaveBeenCalledTimes(1);
      expect(result).toBeInstanceOf(BlogViewDto);
      expect(result.id).toBe(createdBlog.id.toString());

      getByIdSpy.mockRestore();
    });

    it('должен передавать исключения из repository без изменений', async () => {
      const nonExistentId = 99999;
      const getByIdSpy = jest
        .spyOn(blogsQueryRepository, 'getByIdOrNotFoundFail')
        .mockRejectedValue(
          new DomainException({
            code: DomainExceptionCode.NotFound,
            message: `The blog with ID (${nonExistentId}) does not exist`,
          }),
        );

      await expect(queryHandler.execute(new GetBlogQuery(nonExistentId))).rejects.toThrow(
        DomainException,
      );

      expect(getByIdSpy).toHaveBeenCalledWith(nonExistentId);

      getByIdSpy.mockRestore();
    });

    it('должен корректно работать с mapping методом BlogViewDto', async () => {
      const createdBlog: Blog = await createTestBlog();
      const mapToViewSpy = jest.spyOn(BlogViewDto, 'mapToView');

      const result: BlogViewDto = await queryHandler.execute(new GetBlogQuery(createdBlog.id));

      expect(mapToViewSpy).toHaveBeenCalledTimes(1);
      expect(mapToViewSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: createdBlog.id,
          name: createdBlog.name,
          description: createdBlog.description,
          websiteUrl: createdBlog.websiteUrl,
        }),
      );

      expect(result).toBeInstanceOf(BlogViewDto);

      mapToViewSpy.mockRestore();
    });
  });
});
