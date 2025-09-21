import { Test, TestingModule } from '@nestjs/testing';
import { GetBlogsQuery, GetBlogsQueryHandler } from './get-blogs.query-handler';
import { BlogsQueryRepository } from '../../infrastructure/query/blogs.query-repository';
import { DataSource, Repository } from 'typeorm';
import { Blog } from '../../domain/entities/blog.entity';
import { DatabaseModule } from '../../../../database/database.module';
import { CoreModule } from '../../../../../core/core.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Post } from '../../../posts/domain/entities/post.entity';
import { BlogInputDto } from '../../api/input-dto/blog.input-dto';
import {
  BlogsSortBy,
  GetBlogsQueryParams,
} from '../../api/input-dto/get-blogs-query-params.input-dto';
import { PaginatedViewDto } from '../../../../../core/dto/paginated.view-dto';
import { BlogViewDto } from '../../api/view-dto/blog.view-dto';
import { SortDirection } from '../../../../../core/dto/base.query-params.input-dto';

describe('GetBlogsQueryHandler (Integration)', () => {
  let module: TestingModule;
  let queryHandler: GetBlogsQueryHandler;
  let blogsQueryRepository: BlogsQueryRepository;
  let dataSource: DataSource;
  let blogRepo: Repository<Blog>;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DatabaseModule, CoreModule, TypeOrmModule.forFeature([Blog, Post])],
      providers: [GetBlogsQueryHandler, BlogsQueryRepository],
    }).compile();

    queryHandler = module.get<GetBlogsQueryHandler>(GetBlogsQueryHandler);
    blogsQueryRepository = module.get<BlogsQueryRepository>(BlogsQueryRepository);
    dataSource = module.get<DataSource>(DataSource);
    blogRepo = dataSource.getRepository(Blog);
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
      websiteUrl: 'https://testblog.example.com',
      ...blogData,
    };

    const blog: Blog = Blog.create(defaultData);
    return await blogRepo.save(blog);
  };

  const createMultipleTestBlogs = async (count: number): Promise<Blog[]> => {
    const blogs: Blog[] = [];
    for (let i = 0; i < count; i++) {
      const blog = await createTestBlog({
        name: `Blog ${i + 1}`,
        description: `Description for blog ${i + 1}`,
        websiteUrl: `https://blog${i + 1}.example.com`,
      });
      blogs.push(blog);

      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    return blogs;
  };

  const createQueryParams = (overrides?: Partial<GetBlogsQueryParams>): GetBlogsQueryParams => {
    const params = new GetBlogsQueryParams();
    Object.assign(params, overrides);

    return params;
  };

  describe('базовая функциональность', () => {
    it('должен вернуть пустой список когда нет блогов', async () => {
      const queryParams: GetBlogsQueryParams = createQueryParams();

      const result: PaginatedViewDto<BlogViewDto> = await queryHandler.execute(
        new GetBlogsQuery(queryParams),
      );

      expect(result).toBeDefined();
      expect(result.items).toEqual([]);
      expect(result.totalCount).toBe(0);
      expect(result.pagesCount).toBe(0);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
    });

    it('должен вернуть список всех блогов с дефолтными параметрами', async () => {
      await createMultipleTestBlogs(3);
      const queryParams: GetBlogsQueryParams = createQueryParams();

      const result: PaginatedViewDto<BlogViewDto> = await queryHandler.execute(
        new GetBlogsQuery(queryParams),
      );

      expect(result).toBeDefined();
      expect(result.items).toHaveLength(3);
      expect(result.totalCount).toBe(3);
      expect(result.pagesCount).toBe(1);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);

      result.items.forEach((item) => {
        expect(item).toBeInstanceOf(BlogViewDto);
        expect(typeof item.id).toBe('string');
        expect(typeof item.name).toBe('string');
        expect(typeof item.description).toBe('string');
        expect(typeof item.websiteUrl).toBe('string');
        expect(typeof item.createdAt).toBe('string');
        expect(typeof item.isMembership).toBe('boolean');
      });
    });

    it('должен корректно преобразовывать Blog entity в BlogViewDto', async () => {
      const testBlog: Blog = await createTestBlog({
        name: 'Conversion Blog',
        description: 'Testing entity to DTO conversion',
        websiteUrl: 'https://conversion.example.com',
      });
      const queryParams: GetBlogsQueryParams = createQueryParams();

      const result: PaginatedViewDto<BlogViewDto> = await queryHandler.execute(
        new GetBlogsQuery(queryParams),
      );

      expect(result.items).toHaveLength(1);
      const blogDto: BlogViewDto = result.items[0];

      expect(blogDto.id).toBe(testBlog.id.toString());
      expect(blogDto.name).toBe(testBlog.name);
      expect(blogDto.description).toBe(testBlog.description);
      expect(blogDto.websiteUrl).toBe(testBlog.websiteUrl);
      expect(blogDto.createdAt).toBe(testBlog.createdAt.toISOString());
      expect(blogDto.isMembership).toBe(testBlog.isMembership);
    });
  });

  describe('пагинация', () => {
    beforeEach(async () => {
      await createMultipleTestBlogs(25);
    });

    it('должен корректно обрабатывать первую страницу с дефолтным размером', async () => {
      const queryParams: GetBlogsQueryParams = createQueryParams({
        pageNumber: 1,
        pageSize: 10,
      });

      const result: PaginatedViewDto<BlogViewDto> = await queryHandler.execute(
        new GetBlogsQuery(queryParams),
      );

      expect(result.items).toHaveLength(10);
      expect(result.totalCount).toBe(25);
      expect(result.pagesCount).toBe(3);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
    });

    it('должен корректно обрабатывать вторую страницу', async () => {
      const queryParams: GetBlogsQueryParams = createQueryParams({
        pageNumber: 2,
        pageSize: 10,
      });

      const result: PaginatedViewDto<BlogViewDto> = await queryHandler.execute(
        new GetBlogsQuery(queryParams),
      );

      expect(result.items).toHaveLength(10);
      expect(result.totalCount).toBe(25);
      expect(result.pagesCount).toBe(3);
      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(10);
    });

    it('должен корректно обрабатывать последнюю страницу с неполным количеством элементов', async () => {
      const queryParams: GetBlogsQueryParams = createQueryParams({
        pageNumber: 3,
        pageSize: 10,
      });

      const result: PaginatedViewDto<BlogViewDto> = await queryHandler.execute(
        new GetBlogsQuery(queryParams),
      );

      expect(result.items).toHaveLength(5);
      expect(result.totalCount).toBe(25);
      expect(result.pagesCount).toBe(3);
      expect(result.page).toBe(3);
      expect(result.pageSize).toBe(10);
    });

    it('должен корректно обрабатывать различные размеры страниц', async () => {
      const queryParams: GetBlogsQueryParams = createQueryParams({
        pageNumber: 2,
        pageSize: 7,
      });

      const result: PaginatedViewDto<BlogViewDto> = await queryHandler.execute(
        new GetBlogsQuery(queryParams),
      );

      expect(result.items).toHaveLength(7);
      expect(result.totalCount).toBe(25);
      expect(result.pagesCount).toBe(4);
      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(7);
    });

    //TODO: баг с подсчетом totalCount
    // it.only('должен возвращать пустой список для несуществующей страницы', async () => {
    //   const queryParams: GetBlogsQueryParams = createQueryParams({
    //     pageNumber: 10,
    //     pageSize: 10,
    //   });
    //
    //   const result: PaginatedViewDto<BlogViewDto> = await queryHandler.execute(
    //     new GetBlogsQuery(queryParams),
    //   );
    //
    //   expect(result.items).toHaveLength(0);
    //   expect(result.totalCount).toBe(25);
    //   expect(result.pagesCount).toBe(3);
    //   expect(result.page).toBe(10);
    //   expect(result.pageSize).toBe(10);
    // });
  });

  describe('сортировка', () => {
    beforeEach(async () => {
      await createTestBlog({ name: 'C Blog' });
      await new Promise((resolve) => setTimeout(resolve, 10));
      await createTestBlog({ name: 'A Blog' });
      await new Promise((resolve) => setTimeout(resolve, 10));
      await createTestBlog({ name: 'B Blog' });
    });

    it('должен сортировать по createdAt в порядке убывания по умолчанию', async () => {
      const queryParams: GetBlogsQueryParams = createQueryParams({
        sortBy: BlogsSortBy.CreatedAt,
        sortDirection: SortDirection.Descending,
      });

      const result: PaginatedViewDto<BlogViewDto> = await queryHandler.execute(
        new GetBlogsQuery(queryParams),
      );

      expect(result.items).toHaveLength(3);
      expect(result.items[0].name).toBe('B Blog');
      expect(result.items[1].name).toBe('A Blog');
      expect(result.items[2].name).toBe('C Blog');
    });

    it('должен сортировать по createdAt в порядке возрастания', async () => {
      const queryParams: GetBlogsQueryParams = createQueryParams({
        sortBy: BlogsSortBy.CreatedAt,
        sortDirection: SortDirection.Ascending,
      });

      const result: PaginatedViewDto<BlogViewDto> = await queryHandler.execute(
        new GetBlogsQuery(queryParams),
      );

      expect(result.items).toHaveLength(3);
      expect(result.items[0].name).toBe('C Blog');
      expect(result.items[1].name).toBe('A Blog');
      expect(result.items[2].name).toBe('B Blog');
    });

    it('должен сортировать по name в порядке возрастания', async () => {
      const queryParams: GetBlogsQueryParams = createQueryParams({
        sortBy: BlogsSortBy.Name,
        sortDirection: SortDirection.Ascending,
      });

      const result: PaginatedViewDto<BlogViewDto> = await queryHandler.execute(
        new GetBlogsQuery(queryParams),
      );

      expect(result.items).toHaveLength(3);
      expect(result.items[0].name).toBe('A Blog');
      expect(result.items[1].name).toBe('B Blog');
      expect(result.items[2].name).toBe('C Blog');
    });

    it('должен сортировать по name в порядке убывания', async () => {
      const queryParams: GetBlogsQueryParams = createQueryParams({
        sortBy: BlogsSortBy.Name,
        sortDirection: SortDirection.Descending,
      });

      const result: PaginatedViewDto<BlogViewDto> = await queryHandler.execute(
        new GetBlogsQuery(queryParams),
      );

      expect(result.items).toHaveLength(3);
      expect(result.items[0].name).toBe('C Blog');
      expect(result.items[1].name).toBe('B Blog');
      expect(result.items[2].name).toBe('A Blog');
    });

    it('должен сортировать по updatedAt', async () => {
      const blogs: Blog[] = await blogRepo.find();
      const blogToUpdate: Blog | undefined = blogs.find((b) => b.name === 'A Blog');

      if (blogToUpdate) {
        blogToUpdate.update({
          id: blogToUpdate.id,
          name: 'A Blog Updated',
          description: blogToUpdate.description,
          websiteUrl: blogToUpdate.websiteUrl,
        });
        await blogRepo.save(blogToUpdate);
      }

      const queryParams: GetBlogsQueryParams = createQueryParams({
        sortBy: BlogsSortBy.UpdatedAt,
        sortDirection: SortDirection.Descending,
      });

      const result: PaginatedViewDto<BlogViewDto> = await queryHandler.execute(
        new GetBlogsQuery(queryParams),
      );

      expect(result.items).toHaveLength(3);
      expect(result.items[0].name).toBe('A Blog Updated');
    });
  });

  describe('поиск по имени', () => {
    beforeEach(async () => {
      await createTestBlog({ name: 'Tech Blog' });
      await createTestBlog({ name: 'Food Blog' });
      await createTestBlog({ name: 'Travel Journal' });
      await createTestBlog({ name: 'Technology News' });
    });

    it('должен находить блоги по частичному совпадению имени (case insensitive)', async () => {
      const queryParams: GetBlogsQueryParams = createQueryParams({
        searchNameTerm: 'tech',
      });

      const result: PaginatedViewDto<BlogViewDto> = await queryHandler.execute(
        new GetBlogsQuery(queryParams),
      );

      expect(result.items).toHaveLength(2);
      expect(result.totalCount).toBe(2);

      const names: string[] = result.items.map((item) => item.name).sort();
      expect(names).toEqual(['Tech Blog', 'Technology News']);
    });

    it('должен находить блоги с точным совпадением', async () => {
      const queryParams: GetBlogsQueryParams = createQueryParams({
        searchNameTerm: 'Food Blog',
      });

      const result: PaginatedViewDto<BlogViewDto> = await queryHandler.execute(
        new GetBlogsQuery(queryParams),
      );

      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe('Food Blog');
    });

    it('должен возвращать пустой список если ничего не найдено', async () => {
      const queryParams: GetBlogsQueryParams = createQueryParams({
        searchNameTerm: 'NonExistent',
      });

      const result: PaginatedViewDto<BlogViewDto> = await queryHandler.execute(
        new GetBlogsQuery(queryParams),
      );

      expect(result.items).toHaveLength(0);
      expect(result.totalCount).toBe(0);
      expect(result.pagesCount).toBe(0);
    });

    it('должен корректно обрабатывать поиск с пагинацией', async () => {
      for (let i = 1; i <= 15; i++) {
        await createTestBlog({ name: `Tech Blog ${i}` });
      }

      const queryParams: GetBlogsQueryParams = createQueryParams({
        searchNameTerm: 'tech',
        pageSize: 5,
        pageNumber: 2,
      });

      const result: PaginatedViewDto<BlogViewDto> = await queryHandler.execute(
        new GetBlogsQuery(queryParams),
      );

      expect(result.items).toHaveLength(5);
      expect(result.totalCount).toBe(17);
      expect(result.pagesCount).toBe(4);
      expect(result.page).toBe(2);
    });

    it('должен комбинировать поиск с сортировкой', async () => {
      const queryParams: GetBlogsQueryParams = createQueryParams({
        searchNameTerm: 'tech',
        sortBy: BlogsSortBy.Name,
        sortDirection: SortDirection.Ascending,
      });

      const result: PaginatedViewDto<BlogViewDto> = await queryHandler.execute(
        new GetBlogsQuery(queryParams),
      );

      expect(result.items).toHaveLength(2);
      expect(result.items[0].name).toBe('Tech Blog');
      expect(result.items[1].name).toBe('Technology News');
    });
  });

  describe('комбинированные сценарии', () => {
    beforeEach(async () => {
      const blogsData: Partial<BlogInputDto>[] = [
        { name: 'Android Develop', description: 'Mobile development' },
        { name: 'Web Development', description: 'Frontend and backend' },
        { name: 'Data Science', description: 'Analytics and ML' },
        { name: 'DevOps Guide', description: 'Infrastructure management' },
        { name: 'React Tutorial', description: 'Frontend framework' },
        { name: 'Node.js Tips', description: 'Backend development' },
        { name: 'Python Basics', description: 'Programming fundamentals' },
        { name: 'Database Design', description: 'SQL and NoSQL' },
      ];

      for (const blogData of blogsData) {
        await createTestBlog(blogData);
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    });

    it('должен корректно обрабатывать поиск + сортировку + пагинацию', async () => {
      const queryParams: GetBlogsQueryParams = createQueryParams({
        searchNameTerm: 'dev',
        sortBy: BlogsSortBy.Name,
        sortDirection: SortDirection.Ascending,
        pageSize: 2,
        pageNumber: 1,
      });

      const result: PaginatedViewDto<BlogViewDto> = await queryHandler.execute(
        new GetBlogsQuery(queryParams),
      );

      expect(result.items).toHaveLength(2);
      expect(result.totalCount).toBe(3); // Android Develop, Web Development, DevOps Guide
      expect(result.pagesCount).toBe(2);

      // Должны быть отсортированы по имени по возрастанию
      expect(result.items[0].name).toBe('Android Develop');
      expect(result.items[1].name).toBe('DevOps Guide');
    });

    it('должен обрабатывать максимальный pageSize', async () => {
      const queryParams: GetBlogsQueryParams = createQueryParams({
        pageSize: 100,
        pageNumber: 1,
      });

      const result: PaginatedViewDto<BlogViewDto> = await queryHandler.execute(
        new GetBlogsQuery(queryParams),
      );

      expect(result.items).toHaveLength(8);
      expect(result.totalCount).toBe(8);
      expect(result.pagesCount).toBe(1);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(100);
    });

    it('должен обрабатывать минимальный pageSize', async () => {
      const queryParams: GetBlogsQueryParams = createQueryParams({
        pageSize: 1,
        pageNumber: 3,
      });

      const result: PaginatedViewDto<BlogViewDto> = await queryHandler.execute(
        new GetBlogsQuery(queryParams),
      );

      expect(result.items).toHaveLength(1);
      expect(result.totalCount).toBe(8);
      expect(result.pagesCount).toBe(8);
      expect(result.page).toBe(3);
      expect(result.pageSize).toBe(1);
    });
  });

  describe('производительность и стабильность', () => {
    it('должен эффективно обрабатывать большое количество блогов', async () => {
      const blogCount = 1000;
      const blogs: Promise<Blog>[] = [];

      for (let i = 0; i < blogCount; i++) {
        blogs.push(
          createTestBlog({
            name: `Test Blog ${i}`,
            description: `Description ${i}`,
            websiteUrl: `https://perf${i}.example.com`,
          }),
        );
      }
      await Promise.all(blogs);

      const queryParams: GetBlogsQueryParams = createQueryParams({
        pageSize: 200,
        pageNumber: 3,
      });

      const startTime: number = Date.now();

      const result: PaginatedViewDto<BlogViewDto> = await queryHandler.execute(
        new GetBlogsQuery(queryParams),
      );

      const endTime: number = Date.now();
      const executionTime: number = endTime - startTime;

      expect(result.items).toHaveLength(200);
      expect(result.totalCount).toBe(blogCount);
      expect(result.pagesCount).toBe(5);
      expect(executionTime).toBeLessThan(1000);
    }, 10000);

    it('должен корректно обрабатывать конкурентные запросы', async () => {
      await createMultipleTestBlogs(10);

      const queries: Promise<PaginatedViewDto<BlogViewDto>>[] = Array(5)
        .fill(null)
        .map((_, index) => {
          const queryParams: GetBlogsQueryParams = createQueryParams({
            pageNumber: index + 1,
            pageSize: 2,
          });
          return queryHandler.execute(new GetBlogsQuery(queryParams));
        });

      const results: PaginatedViewDto<BlogViewDto>[] = await Promise.all(queries);

      results.forEach((result, index) => {
        expect(result.page).toBe(index + 1);
        expect(result.pageSize).toBe(2);
        expect(result.totalCount).toBe(10);
        expect(result.pagesCount).toBe(5);
      });
    });
  });

  describe('интеграция с repository', () => {
    it('должен правильно вызывать метод blogsQueryRepository.getAll', async () => {
      await createTestBlog();
      const queryParams: GetBlogsQueryParams = createQueryParams();
      const getAllSpy = jest.spyOn(blogsQueryRepository, 'getAll');

      await queryHandler.execute(new GetBlogsQuery(queryParams));

      expect(getAllSpy).toHaveBeenCalledWith(queryParams);
      expect(getAllSpy).toHaveBeenCalledTimes(1);

      getAllSpy.mockRestore();
    });

    it('должен передавать все параметры в repository без изменений', async () => {
      const queryParams: GetBlogsQueryParams = createQueryParams({
        pageNumber: 2,
        pageSize: 5,
        sortBy: BlogsSortBy.Name,
        sortDirection: SortDirection.Ascending,
        searchNameTerm: 'test',
      });

      const getAllSpy = jest.spyOn(blogsQueryRepository, 'getAll');

      await queryHandler.execute(new GetBlogsQuery(queryParams));

      const calledWith: GetBlogsQueryParams = getAllSpy.mock.calls[0][0];
      expect(calledWith.pageNumber).toBe(queryParams.pageNumber);
      expect(calledWith.pageSize).toBe(queryParams.pageSize);
      expect(calledWith.sortBy).toBe(queryParams.sortBy);
      expect(calledWith.sortDirection).toBe(queryParams.sortDirection);
      expect(calledWith.searchNameTerm).toBe(queryParams.searchNameTerm);

      getAllSpy.mockRestore();
    });
  });

  describe('интеграция с repository', () => {
    it('должен правильно вызывать метод blogsQueryRepository.getAll', async () => {
      // Arrange
      await createTestBlog();
      const queryParams = createQueryParams();
      const getAllSpy = jest.spyOn(blogsQueryRepository, 'getAll');

      // Act
      await queryHandler.execute(new GetBlogsQuery(queryParams));

      // Assert
      expect(getAllSpy).toHaveBeenCalledWith(queryParams);
      expect(getAllSpy).toHaveBeenCalledTimes(1);

      getAllSpy.mockRestore();
    });

    it('должен передавать все параметры в repository без изменений', async () => {
      // Arrange
      const queryParams = createQueryParams({
        pageNumber: 2,
        pageSize: 5,
        sortBy: BlogsSortBy.Name,
        sortDirection: SortDirection.Ascending,
        searchNameTerm: 'test',
      });

      const getAllSpy = jest.spyOn(blogsQueryRepository, 'getAll');

      // Act
      await queryHandler.execute(new GetBlogsQuery(queryParams));

      // Assert
      const calledWith = getAllSpy.mock.calls[0][0];
      expect(calledWith.pageNumber).toBe(2);
      expect(calledWith.pageSize).toBe(5);
      expect(calledWith.sortBy).toBe(BlogsSortBy.Name);
      expect(calledWith.sortDirection).toBe(SortDirection.Ascending);
      expect(calledWith.searchNameTerm).toBe('test');

      getAllSpy.mockRestore();
    });
  });

  describe('исключение soft-deleted блогов', () => {
    it('не должен возвращать удаленные блоги (soft deleted)', async () => {
      const blog1: Blog = await createTestBlog({ name: 'Active Blog' });
      const blog2: Blog = await createTestBlog({ name: 'Deleted Blog' });
      const blog3: Blog = await createTestBlog({ name: 'Another Blog' });

      await blogRepo.softDelete(blog2.id);

      const queryParams: GetBlogsQueryParams = createQueryParams();

      const result: PaginatedViewDto<BlogViewDto> = await queryHandler.execute(
        new GetBlogsQuery(queryParams),
      );

      expect(result.items).toHaveLength(2);
      expect(result.totalCount).toBe(2);

      const names: string[] = result.items.map((item) => item.name).sort();
      expect(names).toEqual([blog1.name, blog3.name]);
      expect(names).not.toContain(blog2.name);
    });

    it('должен корректно считать количество активных блогов для пагинации', async () => {
      const blogs: Blog[] = await createMultipleTestBlogs(10);

      for (let i = 0; i < 5; i++) {
        await blogRepo.softDelete(blogs[i].id);
      }

      const queryParams: GetBlogsQueryParams = createQueryParams({
        pageSize: 3,
      });

      const result: PaginatedViewDto<BlogViewDto> = await queryHandler.execute(
        new GetBlogsQuery(queryParams),
      );

      expect(result.items).toHaveLength(3);
      expect(result.totalCount).toBe(5);
      expect(result.pagesCount).toBe(2);
    });
  });
});
