import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, Repository } from 'typeorm';
import { Blog } from '../../domain/entities/blog.entity';
import { BlogsRepository } from '../../infrastructure/blogs.repository';
import { DatabaseModule } from '../../../../database/database.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlogInputDto } from '../../api/input-dto/blog.input-dto';
import { UpdateBlogCommand, UpdateBlogUseCase } from './update-blog.usecase';
import { BlogUpdateDto } from '../dto/blog.update-dto';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';
import { getRelatedEntities } from '../../../../../core/utils/get-related-entities.utility';
import { configModule } from '../../../../../dynamic-config.module';

describe('UpdateBlogUseCase (Integration)', () => {
  let module: TestingModule;
  let useCase: UpdateBlogUseCase;
  let dataSource: DataSource;
  let blogRepo: Repository<Blog>;
  let blogsRepository: BlogsRepository;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [configModule, DatabaseModule, TypeOrmModule.forFeature(getRelatedEntities(Blog))],
      providers: [UpdateBlogUseCase, BlogsRepository],
    }).compile();

    useCase = module.get<UpdateBlogUseCase>(UpdateBlogUseCase);
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

  describe('успешное обновление блога', () => {
    it('должен обновить все поля существующего блога', async () => {
      const originalBlog: Blog = await createTestBlog();

      const updateDto: BlogUpdateDto = {
        id: originalBlog.id,
        name: 'UpdatedBlogName',
        description: 'Updated blog description with new content',
        websiteUrl: 'https://updated.example.com',
      };

      await useCase.execute(new UpdateBlogCommand(updateDto));

      const updatedBlog: Blog | null = await blogRepo.findOneBy({ id: originalBlog.id });

      expect(updatedBlog).toBeDefined();
      expect(updatedBlog).not.toBeNull();
      expect(updatedBlog!.name).toBe(updateDto.name);
      expect(updatedBlog!.description).toBe(updateDto.description);
      expect(updatedBlog!.websiteUrl).toBe(updateDto.websiteUrl);

      expect(updatedBlog!.id).toBe(originalBlog.id);
      expect(updatedBlog!.isMembership).toBe(originalBlog.isMembership);
      expect(updatedBlog!.createdAt).toEqual(originalBlog.createdAt);
      expect(updatedBlog!.deletedAt).toBeNull();

      expect(updatedBlog!.updatedAt!.getTime()).toBeGreaterThan(originalBlog.updatedAt!.getTime());
    });

    it('должен обновить только один указанный блог среди нескольких', async () => {
      const blog1: Blog = await createTestBlog({ name: 'First Blog' });
      const blog2: Blog = await createTestBlog({ name: 'Second Blog' });
      const blog3: Blog = await createTestBlog({ name: 'Third Blog' });

      const updateDto: BlogUpdateDto = {
        id: blog2.id,
        name: 'UpdatedBlog',
        description: 'Updated description for second blog',
        websiteUrl: 'https://updated-second.example.com',
      };

      await useCase.execute(new UpdateBlogCommand(updateDto));

      const [updatedBlog1, updatedBlog2, updatedBlog3] = await Promise.all([
        blogRepo.findOneBy({ id: blog1.id }),
        blogRepo.findOneBy({ id: blog2.id }),
        blogRepo.findOneBy({ id: blog3.id }),
      ]);

      expect(updatedBlog1!.name).toBe('First Blog');
      expect(updatedBlog2!.name).toBe('UpdatedBlog');
      expect(updatedBlog3!.name).toBe('Third Blog');

      expect(updatedBlog2!.description).toBe(updateDto.description);
      expect(updatedBlog2!.websiteUrl).toBe(updateDto.websiteUrl);
    });

    it('должен корректно обрабатывать граничные значения полей при обновлении', async () => {
      const originalBlog: Blog = await createTestBlog();

      // Обновление минимальными значениями
      const minUpdateDto: BlogUpdateDto = {
        id: originalBlog.id,
        name: 'A',
        description: 'B',
        websiteUrl: 'https://a.co',
      };

      await useCase.execute(new UpdateBlogCommand(minUpdateDto));

      const updatedBlogMin: Blog | null = await blogRepo.findOneBy({ id: originalBlog.id });
      expect(updatedBlogMin!.name).toBe(minUpdateDto.name);
      expect(updatedBlogMin!.description).toBe(minUpdateDto.description);
      expect(updatedBlogMin!.websiteUrl).toBe(minUpdateDto.websiteUrl);

      // Обновление максимальными значениями
      const maxUpdateDto: BlogUpdateDto = {
        id: originalBlog.id,
        name: '123456789012345',
        description: 'A'.repeat(500),
        websiteUrl: 'https://' + 'a'.repeat(85) + '.com',
      };

      await useCase.execute(new UpdateBlogCommand(maxUpdateDto));

      const updatedBlogMax: Blog | null = await blogRepo.findOneBy({ id: originalBlog.id });
      expect(updatedBlogMax!.name).toBe(maxUpdateDto.name);
      expect(updatedBlogMax!.description).toBe(maxUpdateDto.description);
      expect(updatedBlogMax!.websiteUrl).toBe(maxUpdateDto.websiteUrl);
    });

    it('должен сохранить временные метки корректно при обновлении', async () => {
      const originalBlog: Blog = await createTestBlog();
      const originalCreatedAt: Date = originalBlog.createdAt;
      const originalUpdatedAt: Date = originalBlog.updatedAt!;

      await new Promise((resolve) => setTimeout(resolve, 10));

      const updateDto: BlogUpdateDto = {
        id: originalBlog.id,
        name: 'New Name',
        description: 'New description',
        websiteUrl: 'https://new.example.com',
      };

      const beforeUpdate = new Date();

      await useCase.execute(new UpdateBlogCommand(updateDto));

      const afterUpdate = new Date();

      const updatedBlog: Blog | null = await blogRepo.findOneBy({ id: originalBlog.id });

      expect(updatedBlog!.createdAt).toEqual(originalCreatedAt);
      expect(updatedBlog!.updatedAt).not.toEqual(originalUpdatedAt);
      expect(updatedBlog!.updatedAt!.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime());
      expect(updatedBlog!.updatedAt!.getTime()).toBeLessThanOrEqual(afterUpdate.getTime());
      expect(updatedBlog!.deletedAt).toBeNull();
    });

    it('должен корректно обрабатывать частичные обновления (одинаковые значения)', async () => {
      const originalBlog: Blog = await createTestBlog({
        name: 'Same Name',
        description: 'Same Description',
        websiteUrl: 'https://same.example.com',
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const updateDto: BlogUpdateDto = {
        id: originalBlog.id,
        name: 'Same Name',
        description: 'Same Description',
        websiteUrl: 'https://same.example.com',
      };

      await useCase.execute(new UpdateBlogCommand(updateDto));

      const updatedBlog: Blog | null = await blogRepo.findOneBy({ id: originalBlog.id });

      expect(updatedBlog!.name).toBe(originalBlog.name);
      expect(updatedBlog!.description).toBe(originalBlog.description);
      expect(updatedBlog!.websiteUrl).toBe(originalBlog.websiteUrl);
      expect(updatedBlog!.updatedAt!.getTime()).toBe(originalBlog.updatedAt!.getTime());
    });
  });

  describe('обработка ошибок', () => {
    it('должен выбрасывать DomainException при попытке обновить несуществующий блог', async () => {
      const nonExistentId = 99999;
      const updateDto: BlogUpdateDto = {
        id: nonExistentId,
        name: 'New Name',
        description: 'New description',
        websiteUrl: 'https://new.example.com',
      };

      await expect(useCase.execute(new UpdateBlogCommand(updateDto))).rejects.toThrow(
        DomainException,
      );
    });

    it('должен выбрасывать DomainException с правильным кодом NotFound', async () => {
      const nonExistentId = 88888;
      const updateDto: BlogUpdateDto = {
        id: nonExistentId,
        name: 'New Name',
        description: 'New description',
        websiteUrl: 'https://new.example.com',
      };

      try {
        await useCase.execute(new UpdateBlogCommand(updateDto));
        fail('Ожидали DomainException');
      } catch (error) {
        expect(error).toBeInstanceOf(DomainException);
        expect(error.code).toBe(DomainExceptionCode.NotFound);
        expect(error.message).toContain(`The blog with ID (${nonExistentId}) does not exist`);
        expect(error.extensions).toBeDefined();
        expect(Array.isArray(error.extensions)).toBe(true);
      }
    });

    it('должен выбрасывать ошибку при попытке обновить удаленный блог', async () => {
      const { id: blogId }: Blog = await createTestBlog();

      await blogRepo.softDelete(blogId);

      const updateDto: BlogUpdateDto = {
        id: blogId,
        name: 'Updated Name',
        description: 'Updated description',
        websiteUrl: 'https://updated.example.com',
      };

      await expect(useCase.execute(new UpdateBlogCommand(updateDto))).rejects.toThrow(
        DomainException,
      );
    });

    it('должен выбрасывать ошибку с корректным сообщением и ID блога', async () => {
      const testId = 12345;
      const updateDto: BlogUpdateDto = {
        id: testId,
        name: 'Test Name',
        description: 'Test description',
        websiteUrl: 'https://test.example.com',
      };

      try {
        await useCase.execute(new UpdateBlogCommand(updateDto));
        fail('Ожидали DomainException');
      } catch (error) {
        expect(error).toBeInstanceOf(DomainException);
        expect(error.message).toBe(`The blog with ID (${testId}) does not exist`);
        expect(error.message).toContain(testId.toString());
      }
    });
  });

  describe('валидация данных', () => {
    it('должен отклонять обновление с невалидным name (превышает максимальную длину)', async () => {
      const originalBlog: Blog = await createTestBlog();

      const updateDto: BlogUpdateDto = {
        id: originalBlog.id,
        name: '1234567890123456',
        description: 'Valid description',
        websiteUrl: 'https://valid.example.com',
      };

      await expect(useCase.execute(new UpdateBlogCommand(updateDto))).rejects.toThrow();

      const unchangedBlog: Blog | null = await blogRepo.findOneBy({ id: originalBlog.id });
      expect(unchangedBlog!.name).toBe(originalBlog.name);
    });

    it('должен отклонять обновление с пустым name', async () => {
      const originalBlog: Blog = await createTestBlog();

      const updateDto: BlogUpdateDto = {
        id: originalBlog.id,
        name: '',
        description: 'Valid description',
        websiteUrl: 'https://valid.example.com',
      };

      await expect(useCase.execute(new UpdateBlogCommand(updateDto))).rejects.toThrow();
    });

    it('должен отклонять обновление с невалидным description (превышает максимальную длину)', async () => {
      const originalBlog: Blog = await createTestBlog();

      const updateDto: BlogUpdateDto = {
        id: originalBlog.id,
        name: 'Valid Name',
        description: 'A'.repeat(501),
        websiteUrl: 'https://valid.example.com',
      };

      await expect(useCase.execute(new UpdateBlogCommand(updateDto))).rejects.toThrow();
    });

    it('должен отклонять обновление с пустым description ', async () => {
      const originalBlog: Blog = await createTestBlog();

      const updateDto: BlogUpdateDto = {
        id: originalBlog.id,
        name: 'Valid Name',
        description: '',
        websiteUrl: 'https://valid.example.com',
      };

      await expect(useCase.execute(new UpdateBlogCommand(updateDto))).rejects.toThrow();
    });

    it.each([
      'http://example.com', // не HTTPS
      'https://example', // нет домена верхнего уровня
      'example.com', // без протокола
      'not-a-url', // не URL
      '', // пустая строка
    ])('должен отклонять обновление с невалидным websiteUrl: %s', async (invalidUrl) => {
      const originalBlog: Blog = await createTestBlog();

      const updateDto: BlogUpdateDto = {
        id: originalBlog.id,
        name: 'Valid Name',
        description: 'Valid description',
        websiteUrl: invalidUrl,
      };

      await expect(useCase.execute(new UpdateBlogCommand(updateDto))).rejects.toThrow();
    });
  });

  describe('граничные случаи', () => {
    it('должен корректно обрабатывать ID равный нулю', async () => {
      const updateDto: BlogUpdateDto = {
        id: 0,
        name: 'Test Name',
        description: 'Test description',
        websiteUrl: 'https://test.example.com',
      };

      await expect(useCase.execute(new UpdateBlogCommand(updateDto))).rejects.toThrow(
        DomainException,
      );
    });

    it('должен корректно обрабатывать отрицательные ID', async () => {
      const updateDto: BlogUpdateDto = {
        id: -1,
        name: 'Test Name',
        description: 'Test description',
        websiteUrl: 'https://test.example.com',
      };

      await expect(useCase.execute(new UpdateBlogCommand(updateDto))).rejects.toThrow(
        DomainException,
      );
    });

    it('должен корректно обрабатывать очень большие ID', async () => {
      const updateDto: BlogUpdateDto = {
        id: Number.MAX_SAFE_INTEGER,
        name: 'Test Name',
        description: 'Test description',
        websiteUrl: 'https://test.example.com',
      };

      await expect(useCase.execute(new UpdateBlogCommand(updateDto))).rejects.toThrow();
    });

    it('должен корректно обрабатывать дробные ID', async () => {
      const updateDto: BlogUpdateDto = {
        id: 123.456,
        name: 'Test Name',
        description: 'Test description',
        websiteUrl: 'https://test.example.com',
      };

      await expect(useCase.execute(new UpdateBlogCommand(updateDto))).rejects.toThrow();
    });
  });

  describe('конкурентность и производительность', () => {
    it('должен корректно обрабатывать конкурентные обновления разных блогов', async () => {
      const blogs: Blog[] = await Promise.all([
        createTestBlog({ name: 'ConcurrentBlog1' }),
        createTestBlog({ name: 'ConcurrentBlog2' }),
        createTestBlog({ name: 'ConcurrentBlog3' }),
      ]);

      const updatePromises = blogs.map((blog, index) => {
        const updateDto: BlogUpdateDto = {
          id: blog.id,
          name: `UpdatedBlog${index + 1}`,
          description: `Updated description ${index + 1}`,
          websiteUrl: `https://updated${index + 1}.example.com`,
        };
        return useCase.execute(new UpdateBlogCommand(updateDto));
      });

      await Promise.all(updatePromises);

      const updatedBlogs = await Promise.all(
        blogs.map((blog) => blogRepo.findOneBy({ id: blog.id })),
      );

      updatedBlogs.forEach((blog, index) => {
        expect(blog!.name).toBe(`UpdatedBlog${index + 1}`);
        expect(blog!.description).toBe(`Updated description ${index + 1}`);
        expect(blog!.websiteUrl).toBe(`https://updated${index + 1}.example.com`);
      });
    });

    it('должен корректно обрабатывать множественные последовательные обновления одного блога', async () => {
      const originalBlog: Blog = await createTestBlog();

      const updates = [
        {
          name: 'First Update',
          description: 'First description',
          websiteUrl: 'https://first.example.com',
        },
        {
          name: 'Second Update',
          description: 'Second description',
          websiteUrl: 'https://second.example.com',
        },
        {
          name: 'Third Update',
          description: 'Third description',
          websiteUrl: 'https://third.example.com',
        },
      ];

      for (const update of updates) {
        const updateDto: BlogUpdateDto = {
          id: originalBlog.id,
          ...update,
        };
        await useCase.execute(new UpdateBlogCommand(updateDto));
      }

      const finalBlog: Blog | null = await blogRepo.findOneBy({ id: originalBlog.id });
      const lastUpdate = updates[updates.length - 1];

      expect(finalBlog!.name).toBe(lastUpdate.name);
      expect(finalBlog!.description).toBe(lastUpdate.description);
      expect(finalBlog!.websiteUrl).toBe(lastUpdate.websiteUrl);
    });
  });

  describe('интеграция с repository', () => {
    it('должен правильно вызывать методы repository в нужном порядке', async () => {
      const originalBlog: Blog = await createTestBlog();

      const updateDto: BlogUpdateDto = {
        id: originalBlog.id,
        name: 'Spy Test Blog',
        description: 'Spy test description',
        websiteUrl: 'https://spy.example.com',
      };

      const getByIdSpy = jest.spyOn(blogsRepository, 'getById');
      const saveSpy = jest.spyOn(blogsRepository, 'save');

      await useCase.execute(new UpdateBlogCommand(updateDto));

      expect(getByIdSpy).toHaveBeenCalledWith(updateDto.id);
      expect(getByIdSpy).toHaveBeenCalledTimes(1);
      expect(saveSpy).toHaveBeenCalledTimes(1);

      const getByIdCall: number = getByIdSpy.mock.invocationCallOrder[0];
      const saveCall: number = saveSpy.mock.invocationCallOrder[0];
      expect(getByIdCall).toBeLessThan(saveCall);

      const saveCallArgs: Blog = saveSpy.mock.calls[0][0];
      expect(saveCallArgs).toBeInstanceOf(Blog);
      expect(saveCallArgs.name).toBe(updateDto.name);
      expect(saveCallArgs.description).toBe(updateDto.description);
      expect(saveCallArgs.websiteUrl).toBe(updateDto.websiteUrl);

      getByIdSpy.mockRestore();
      saveSpy.mockRestore();
    });

    it('не должен вызывать save если блог не найден', async () => {
      const nonExistentId = 99999;

      const updateDto: BlogUpdateDto = {
        id: nonExistentId,
        name: 'Test Name',
        description: 'Test description',
        websiteUrl: 'https://test.example.com',
      };

      const saveSpy = jest.spyOn(blogsRepository, 'save');

      await expect(useCase.execute(new UpdateBlogCommand(updateDto))).rejects.toThrow(
        DomainException,
      );

      expect(saveSpy).not.toHaveBeenCalled();

      saveSpy.mockRestore();
    });
  });
});
