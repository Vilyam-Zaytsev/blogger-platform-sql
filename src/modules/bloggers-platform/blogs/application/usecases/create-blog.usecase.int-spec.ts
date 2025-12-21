import { DataSource, Repository } from 'typeorm';
import { Blog } from '../../domain/entities/blog.entity';
import { CreateBlogCommand, CreateBlogUseCase } from './create-blog.usecase';
import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseModule } from '../../../../database/database.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlogsRepository } from '../../infrastructure/blogs.repository';
import { BlogInputDto } from '../../api/input-dto/blog.input-dto';
import { getRelatedEntities } from '../../../../../core/utils/get-related-entities.utility';
import { configModule } from '../../../../../dynamic-config.module';
import { TransactionHelper } from '../../../../database/trasaction.helper';

describe('CreateBlogUseCase (Integration)', () => {
  let module: TestingModule;
  let useCase: CreateBlogUseCase;
  let dataSource: DataSource;
  let blogRepo: Repository<Blog>;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [configModule, DatabaseModule, TypeOrmModule.forFeature(getRelatedEntities(Blog))],
      providers: [CreateBlogUseCase, BlogsRepository, TransactionHelper],
    }).compile();

    useCase = module.get<CreateBlogUseCase>(CreateBlogUseCase);
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

  describe('успешное создание блога', () => {
    it('должен создать блог с валидными данными и вернуть ID', async () => {
      const dto: BlogInputDto = {
        name: 'Tech Blog',
        description: 'A blog about technology and programming',
        websiteUrl: 'https://techblog.example.com',
      };

      const blogId: number = await useCase.execute(new CreateBlogCommand(dto));

      expect(blogId).toBeDefined();
      expect(typeof blogId).toBe('number');
      expect(blogId).toBeGreaterThan(0);

      const createdBlog: Blog | null = await blogRepo.findOne({
        where: { id: blogId },
      });

      if (!createdBlog) {
        throw new Error(
          'Тест №1: CreateBlogUseCase (Integration): Неудалось найти блог по ID после создания',
        );
      }

      expect(createdBlog).toBeDefined();
      expect(createdBlog).not.toBeNull();
      expect(createdBlog.name).toBe(dto.name);
      expect(createdBlog.description).toBe(dto.description);
      expect(createdBlog.websiteUrl).toBe(dto.websiteUrl);
      expect(createdBlog.isMembership).toBe(false);
      expect(createdBlog.createdAt).toBeInstanceOf(Date);
      expect(createdBlog.updatedAt).toBeInstanceOf(Date);
      expect(createdBlog.deletedAt).toBeNull();
    });

    it('должен корректно обрабатывать граничные значения полей', async () => {
      const minDto: BlogInputDto = {
        name: 'A',
        description: 'B',
        websiteUrl: 'https://a.co',
      };

      const minBlogId: number = await useCase.execute(new CreateBlogCommand(minDto));

      expect(minBlogId).toBeDefined();
      expect(minBlogId).toBeGreaterThan(0);

      const maxDto: BlogInputDto = {
        name: '123456789012345',
        description: 'A'.repeat(500),
        websiteUrl: 'https://' + 'a'.repeat(85) + '.com',
      };

      const maxBlogId: number = await useCase.execute(new CreateBlogCommand(maxDto));

      expect(maxBlogId).toBeDefined();
      expect(maxBlogId).toBeGreaterThan(0);
      expect(maxBlogId).not.toBe(minBlogId);
    });

    it('должен создавать уникальные записи для каждого вызова', async () => {
      const dto1: BlogInputDto = {
        name: 'First Blog',
        description: 'First blog description',
        websiteUrl: 'https://first.example.com',
      };

      const dto2: BlogInputDto = {
        name: 'Second Blog',
        description: 'Second blog description',
        websiteUrl: 'https://second.example.com',
      };

      const [blogId1, blogId2] = await Promise.all([
        useCase.execute(new CreateBlogCommand(dto1)),
        useCase.execute(new CreateBlogCommand(dto2)),
      ]);

      expect(blogId1).not.toBe(blogId2);

      const blogsCount: number = await blogRepo.count();
      expect(blogsCount).toBe(2);
    });
  });

  describe('валидация поля name', () => {
    it('должен отклонять создание блога с пустым name', async () => {
      const dto: BlogInputDto = {
        name: '',
        description: 'Valid description',
        websiteUrl: 'https://valid.example.com',
      };

      await expect(useCase.execute(new CreateBlogCommand(dto))).rejects.toThrowError();
    });

    it('должен отклонять создание блога со слишком длинным name', async () => {
      const dto: BlogInputDto = {
        name: '1234567890123456',
        description: 'Valid description',
        websiteUrl: 'https://valid.example.com',
      };

      await expect(useCase.execute(new CreateBlogCommand(dto))).rejects.toThrowError();
    });
  });

  describe('валидация поля description', () => {
    it('должен отклонять создание блога с пустым description', async () => {
      const dto: BlogInputDto = {
        name: 'Valid Name',
        description: '',
        websiteUrl: 'https://valid.example.com',
      };

      await expect(useCase.execute(new CreateBlogCommand(dto))).rejects.toThrowError();
    });

    it('должен отклонять создание блога со слишком длинным description', async () => {
      const dto: BlogInputDto = {
        name: 'Valid Name',
        description: 'A'.repeat(501),
        websiteUrl: 'https://valid.example.com',
      };

      await expect(useCase.execute(new CreateBlogCommand(dto))).rejects.toThrowError();
    });
  });

  describe('валидация поля websiteUrl', () => {
    it.each([
      'https://example.com',
      'https://subdomain.example.com',
      'https://example.com/path',
      'https://test-site.co.uk',
      'https://my_site.example.org/path/to/page',
    ])('должен принимать валидный websiteUrl: %s', async (validUrl) => {
      const dto: BlogInputDto = {
        name: 'Valid Name',
        description: 'Valid description',
        websiteUrl: validUrl,
      };

      await expect(useCase.execute(new CreateBlogCommand(dto))).resolves.toBeDefined();
    });

    it.each([
      'http://example.com', // не HTTPS
      'https://example', // нет домена верхнего уровня
      'example.com', // без протокола
      'https://.example.com', // некорректный домен
      'https://example.', // некорректное окончание
      'https://exam ple.com', // пробел в URL
      'https://example.com:8080', // порт не разрешен регексом
      '', // пустая строка
      'not-a-url', // не URL
    ])('должен отклонять невалидный websiteUrl: %s', async (invalidUrl) => {
      const dto: BlogInputDto = {
        name: 'Valid Name',
        description: 'Valid description',
        websiteUrl: invalidUrl,
      };

      await expect(useCase.execute(new CreateBlogCommand(dto))).rejects.toThrowError();
    });

    it('должен отклонять websiteUrl превышающий максимальную длину', async () => {
      const longUrl = 'https://' + 'a'.repeat(200) + '.com';
      const dto: BlogInputDto = {
        name: 'Valid Name',
        description: 'Valid description',
        websiteUrl: longUrl,
      };

      await expect(useCase.execute(new CreateBlogCommand(dto))).rejects.toThrowError();
    });
  });

  describe('граничные случаи', () => {
    it('должен корректно обрабатывать создание блога с undefined в DTO', async () => {
      const dto = {
        name: undefined,
        description: undefined,
        websiteUrl: undefined,
      } as any;

      await expect(useCase.execute(new CreateBlogCommand(dto))).rejects.toThrowError();
    });

    it('должен корректно обрабатывать создание блога с null в DTO', async () => {
      const dto = {
        name: null,
        description: null,
        websiteUrl: null,
      } as any;

      await expect(useCase.execute(new CreateBlogCommand(dto))).rejects.toThrowError();
    });

    it('должен корректно работать при большой нагрузке', async () => {
      const promises: Promise<number>[] = [];
      const blogCount = 1000;

      for (let i = 0; i < blogCount; i++) {
        const dto: BlogInputDto = {
          name: `Blog ${i}`,
          description: `Description for blog number ${i}`,
          websiteUrl: `https://blog${i}.example.com`,
        };
        promises.push(useCase.execute(new CreateBlogCommand(dto)));
      }

      const blogIds: number[] = await Promise.all(promises);

      expect(blogIds).toHaveLength(blogCount);
      expect(new Set(blogIds).size).toBe(blogCount);

      const totalBlogs: number = await blogRepo.count();
      expect(totalBlogs).toBe(blogCount);
    }, 10000);
  });
});
