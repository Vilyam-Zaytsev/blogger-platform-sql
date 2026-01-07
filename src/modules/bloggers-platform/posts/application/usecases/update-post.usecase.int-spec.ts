import { Test, TestingModule } from '@nestjs/testing';
import { UpdatePostCommand, UpdatePostUseCase } from './update-post.usecase';
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
import { PostUpdateDto } from '../dto/post.update-dto';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';
import { configModule } from '../../../../../dynamic-config.module';
import { TransactionHelper } from '../../../../../trasaction.helper';

describe('UpdatePostUseCase (Integration)', () => {
  let module: TestingModule;
  let useCase: UpdatePostUseCase;
  let dataSource: DataSource;
  let postRepo: Repository<Post>;
  let blogRepo: Repository<Blog>;
  let postsRepository: PostsRepository;
  let blogsRepository: BlogsRepository;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [configModule, DatabaseModule, TypeOrmModule.forFeature(getRelatedEntities(Post))],
      providers: [UpdatePostUseCase, PostsRepository, BlogsRepository, TransactionHelper],
    }).compile();

    useCase = module.get<UpdatePostUseCase>(UpdatePostUseCase);
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

  describe('успешное обновление поста', () => {
    it('должен обновить все поля существующего поста', async () => {
      const { id: blogId }: Blog = await createTestBlog();
      const originalPost: Post = await createTestPost(blogId);

      const updateDto: PostUpdateDto = {
        blogId,
        postId: originalPost.id,
        title: 'Updated Post Title',
        shortDescription: 'Updated short description',
        content: 'Updated post content with new information',
      };

      await useCase.execute(new UpdatePostCommand(updateDto));

      const updatedPost: Post | null = await postRepo.findOneBy({ id: originalPost.id });

      expect(updatedPost).toBeDefined();
      expect(updatedPost).not.toBeNull();
      expect(updatedPost!.title).toBe(updateDto.title);
      expect(updatedPost!.shortDescription).toBe(updateDto.shortDescription);
      expect(updatedPost!.content).toBe(updateDto.content);
      expect(updatedPost!.blogId).toBe(blogId);

      expect(updatedPost!.id).toBe(originalPost.id);
      expect(updatedPost!.createdAt).toEqual(originalPost.createdAt);
      expect(updatedPost!.deletedAt).toBeNull();

      expect(updatedPost!.updatedAt!.getTime()).toBeGreaterThan(originalPost.updatedAt!.getTime());
    });
  });

  it('должен обновить только один указанный пост среди нескольких', async () => {
    const { id: blogId }: Blog = await createTestBlog();
    const post1: Post = await createTestPost(blogId, { title: 'First Post' });
    const post2: Post = await createTestPost(blogId, { title: 'Second Post' });
    const post3: Post = await createTestPost(blogId, { title: 'Third Post' });

    const updateDto: PostUpdateDto = {
      blogId,
      postId: post2.id,
      title: 'Updated Second Post',
      shortDescription: 'Updated description for second post',
      content: 'Updated content for second post',
    };

    await useCase.execute(new UpdatePostCommand(updateDto));

    const [updatedPost1, updatedPost2, updatedPost3] = await Promise.all([
      postRepo.findOneBy({ id: post1.id }),
      postRepo.findOneBy({ id: post2.id }),
      postRepo.findOneBy({ id: post3.id }),
    ]);

    expect(updatedPost1!.title).toBe(post1.title);
    expect(updatedPost2!.title).toBe(updateDto.title);
    expect(updatedPost3!.title).toBe(post3.title);

    expect(updatedPost2!.shortDescription).toBe(updateDto.shortDescription);
    expect(updatedPost2!.content).toBe(updateDto.content);
  });

  it('должен корректно обрабатывать граничные значения полей при обновлении', async () => {
    const { id: blogId }: Blog = await createTestBlog();
    const originalPost: Post = await createTestPost(blogId);

    // Минимальные значения
    const minUpdateDto: PostUpdateDto = {
      blogId,
      postId: originalPost.id,
      title: 'A',
      shortDescription: 'B',
      content: 'C',
    };

    await useCase.execute(new UpdatePostCommand(minUpdateDto));

    const updatedPostMin: Post | null = await postRepo.findOneBy({ id: originalPost.id });
    expect(updatedPostMin!.title).toBe(minUpdateDto.title);
    expect(updatedPostMin!.shortDescription).toBe(minUpdateDto.shortDescription);
    expect(updatedPostMin!.content).toBe(minUpdateDto.content);

    // Максимальные значения
    const maxUpdateDto: PostUpdateDto = {
      blogId,
      postId: originalPost.id,
      title: 'A'.repeat(30),
      shortDescription: 'B'.repeat(100),
      content: 'C'.repeat(1000),
    };

    await useCase.execute(new UpdatePostCommand(maxUpdateDto));

    const updatedPostMax: Post | null = await postRepo.findOneBy({ id: originalPost.id });
    expect(updatedPostMax!.title).toBe(maxUpdateDto.title);
    expect(updatedPostMax!.shortDescription).toBe(maxUpdateDto.shortDescription);
    expect(updatedPostMax!.content).toBe(maxUpdateDto.content);
  });

  it('должен сохранить временные метки корректно при обновлении', async () => {
    const { id: blogId }: Blog = await createTestBlog();
    const originalPost: Post = await createTestPost(blogId);
    const originalCreatedAt: Date = originalPost.createdAt;
    const originalUpdatedAt: Date = originalPost.updatedAt!;

    await new Promise((resolve) => setTimeout(resolve, 10));

    const updateDto: PostUpdateDto = {
      blogId,
      postId: originalPost.id,
      title: 'New Title',
      shortDescription: 'New description',
      content: 'New content',
    };

    const beforeUpdate = new Date();

    await useCase.execute(new UpdatePostCommand(updateDto));

    const afterUpdate = new Date();

    const updatedPost: Post | null = await postRepo.findOneBy({ id: originalPost.id });

    expect(updatedPost!.createdAt).toEqual(originalCreatedAt);
    expect(updatedPost!.updatedAt).not.toEqual(originalUpdatedAt);
    expect(updatedPost!.updatedAt!.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime());
    expect(updatedPost!.updatedAt!.getTime()).toBeLessThanOrEqual(afterUpdate.getTime());
    expect(updatedPost!.deletedAt).toBeNull();
  });

  it('должен корректно обрабатывать частичные обновления (одинаковые значения)', async () => {
    const { id: blogId }: Blog = await createTestBlog();

    const originalData = {
      title: 'Same Title',
      shortDescription: 'Same Description',
      content: 'Same Content',
    };
    const originalPost: Post = await createTestPost(blogId, originalData);

    await new Promise((resolve) => setTimeout(resolve, 10));

    const updateDto: PostUpdateDto = {
      blogId,
      postId: originalPost.id,
      title: 'Same Title',
      shortDescription: 'Same Description',
      content: 'Same Content',
    };

    await useCase.execute(new UpdatePostCommand(updateDto));

    const updatedPost: Post | null = await postRepo.findOneBy({ id: originalPost.id });

    expect(updatedPost!.title).toBe(originalPost.title);
    expect(updatedPost!.shortDescription).toBe(originalPost.shortDescription);
    expect(updatedPost!.content).toBe(originalPost.content);
    expect(updatedPost!.updatedAt!.getTime()).toBe(originalPost.updatedAt!.getTime());
  });

  describe('обработка ошибок', () => {
    it('должен выбрасывать DomainException при попытке обновить пост с несуществующим blogId', async () => {
      const nonExistentBlogId = 99999;

      const updateDto: PostUpdateDto = {
        blogId: nonExistentBlogId,
        postId: 1,
        title: 'New Title',
        shortDescription: 'New description',
        content: 'New content',
      };

      await expect(useCase.execute(new UpdatePostCommand(updateDto))).rejects.toThrow(
        DomainException,
      );

      try {
        await useCase.execute(new UpdatePostCommand(updateDto));
        fail('Ожидали DomainException');
      } catch (error) {
        expect(error).toBeInstanceOf(DomainException);
        expect(error.code).toBe(DomainExceptionCode.NotFound);
        expect(error.message).toContain(`The blog with ID (${nonExistentBlogId}) does not exist`);
      }
    });

    it('должен выбрасывать DomainException при попытке обновить несуществующий пост', async () => {
      const { id: blogId }: Blog = await createTestBlog();
      const nonExistentPostId = 88888;

      const updateDto: PostUpdateDto = {
        blogId,
        postId: nonExistentPostId,
        title: 'New Title',
        shortDescription: 'New description',
        content: 'New content',
      };

      try {
        await useCase.execute(new UpdatePostCommand(updateDto));
        fail('Ожидали DomainException');
      } catch (error) {
        expect(error).toBeInstanceOf(DomainException);
        expect(error.code).toBe(DomainExceptionCode.NotFound);
        expect(error.message).toContain(`The post with ID (${nonExistentPostId}) does not exist`);
      }
    });

    it('должен выбрасывать DomainException при попытке обновить пост другого блога', async () => {
      const { id: blogId_1 }: Blog = await createTestBlog();
      const { id: blogId_2 }: Blog = await createTestBlog();
      const { id: postId }: Post = await createTestPost(blogId_2);

      const updateDto: PostUpdateDto = {
        blogId: blogId_1,
        postId,
        title: 'New Title',
        shortDescription: 'New description',
        content: 'New content',
      };

      try {
        await useCase.execute(new UpdatePostCommand(updateDto));
        fail('Ожидали DomainException');
      } catch (error) {
        expect(error).toBeInstanceOf(DomainException);
        expect(error.code).toBe(DomainExceptionCode.Forbidden);
        expect(error.message).toContain(
          `The post with the ID (${postId}) does not belong to the blog with the ID (${blogId_1})`,
        );
      }
    });

    it('должен выбрасывать ошибку при попытке обновить удаленный пост', async () => {
      const { id: blogId }: Blog = await createTestBlog();
      const { id: postId }: Post = await createTestPost(blogId);

      await postRepo.softDelete(postId);

      const updateDto: PostUpdateDto = {
        blogId,
        postId,
        title: 'Updated Title',
        shortDescription: 'Updated description',
        content: 'Updated content',
      };

      await expect(useCase.execute(new UpdatePostCommand(updateDto))).rejects.toThrow(
        DomainException,
      );
    });

    it('должен выбрасывать ошибку при попытке обновить пост в удаленном блоге', async () => {
      const { id: blogId }: Blog = await createTestBlog();
      const { id: postId }: Post = await createTestPost(blogId);
      await blogRepo.softDelete(blogId);

      const updateDto: PostUpdateDto = {
        blogId,
        postId,
        title: 'Updated Title',
        shortDescription: 'Updated description',
        content: 'Updated content',
      };

      await expect(useCase.execute(new UpdatePostCommand(updateDto))).rejects.toThrow(
        DomainException,
      );
    });
  });

  describe('валидация данных', () => {
    let blog: Blog;
    let post: Post;

    beforeEach(async () => {
      blog = await createTestBlog();
      post = await createTestPost(blog.id);
    });

    it('должен отклонять обновление с пустым title', async () => {
      const updateDto: PostUpdateDto = {
        blogId: blog.id,
        postId: post.id,
        title: '',
        shortDescription: 'Valid description',
        content: 'Valid content',
      };

      await expect(useCase.execute(new UpdatePostCommand(updateDto))).rejects.toThrow();
    });

    it('должен отклонять обновление с title превышающим максимальную длину', async () => {
      const updateDto: PostUpdateDto = {
        blogId: blog.id,
        postId: post.id,
        title: 'A'.repeat(31),
        shortDescription: 'Valid description',
        content: 'Valid content',
      };

      await expect(useCase.execute(new UpdatePostCommand(updateDto))).rejects.toThrow();
    });

    it('должен отклонять обновление с пустым shortDescription', async () => {
      const updateDto: PostUpdateDto = {
        blogId: blog.id,
        postId: post.id,
        title: 'Valid Title',
        shortDescription: '',
        content: 'Valid content',
      };

      await expect(useCase.execute(new UpdatePostCommand(updateDto))).rejects.toThrow();
    });

    it('должен отклонять обновление с shortDescription превышающим максимальную длину', async () => {
      const updateDto: PostUpdateDto = {
        blogId: blog.id,
        postId: post.id,
        title: 'Valid Title',
        shortDescription: 'A'.repeat(101),
        content: 'Valid content',
      };

      await expect(useCase.execute(new UpdatePostCommand(updateDto))).rejects.toThrow();
    });

    it('должен отклонять обновление с пустым content', async () => {
      const updateDto: PostUpdateDto = {
        blogId: blog.id,
        postId: post.id,
        title: 'Valid Title',
        shortDescription: 'Valid description',
        content: '',
      };

      await expect(useCase.execute(new UpdatePostCommand(updateDto))).rejects.toThrow();
    });

    it('должен отклонять обновление с content превышающим максимальную длину', async () => {
      const updateDto: PostUpdateDto = {
        blogId: blog.id,
        postId: post.id,
        title: 'Valid Title',
        shortDescription: 'Valid description',
        content: 'A'.repeat(1001),
      };

      await expect(useCase.execute(new UpdatePostCommand(updateDto))).rejects.toThrow();
    });
  });

  describe('граничные случаи', () => {
    let blog: Blog;
    let post: Post;

    beforeEach(async () => {
      blog = await createTestBlog();
      post = await createTestPost(blog.id);
    });

    it('должен корректно обрабатывать ID равные нулю', async () => {
      const updateDto_1: PostUpdateDto = {
        blogId: 0,
        postId: post.id,
        title: 'Test Title',
        shortDescription: 'Test description',
        content: 'Test content',
      };

      const updateDto_2: PostUpdateDto = {
        blogId: blog.id,
        postId: 0,
        title: 'Test Title',
        shortDescription: 'Test description',
        content: 'Test content',
      };

      await expect(useCase.execute(new UpdatePostCommand(updateDto_1))).rejects.toThrow(
        DomainException,
      );
      await expect(useCase.execute(new UpdatePostCommand(updateDto_2))).rejects.toThrow(
        DomainException,
      );
    });

    it('должен корректно обрабатывать отрицательные ID', async () => {
      const updateDto_1: PostUpdateDto = {
        blogId: -1,
        postId: post.id,
        title: 'Test Title',
        shortDescription: 'Test description',
        content: 'Test content',
      };

      const updateDto_2: PostUpdateDto = {
        blogId: blog.id,
        postId: -1,
        title: 'Test Title',
        shortDescription: 'Test description',
        content: 'Test content',
      };

      await expect(useCase.execute(new UpdatePostCommand(updateDto_1))).rejects.toThrow(
        DomainException,
      );
      await expect(useCase.execute(new UpdatePostCommand(updateDto_2))).rejects.toThrow(
        DomainException,
      );
    });

    it('должен корректно обрабатывать очень большие ID', async () => {
      const updateDto_1: PostUpdateDto = {
        blogId: Number.MAX_SAFE_INTEGER,
        postId: post.id,
        title: 'Test Title',
        shortDescription: 'Test description',
        content: 'Test content',
      };

      const updateDto_2: PostUpdateDto = {
        blogId: blog.id,
        postId: Number.MAX_SAFE_INTEGER,
        title: 'Test Title',
        shortDescription: 'Test description',
        content: 'Test content',
      };

      await expect(useCase.execute(new UpdatePostCommand(updateDto_1))).rejects.toThrow();
      await expect(useCase.execute(new UpdatePostCommand(updateDto_2))).rejects.toThrow();
    });

    it('должен корректно обрабатывать дробные ID', async () => {
      const updateDto_1: PostUpdateDto = {
        blogId: 123.456,
        postId: post.id,
        title: 'Test Title',
        shortDescription: 'Test description',
        content: 'Test content',
      };

      const updateDto_2: PostUpdateDto = {
        blogId: blog.id,
        postId: 789.012,
        title: 'Test Title',
        shortDescription: 'Test description',
        content: 'Test content',
      };

      await expect(useCase.execute(new UpdatePostCommand(updateDto_1))).rejects.toThrow();
      await expect(useCase.execute(new UpdatePostCommand(updateDto_2))).rejects.toThrow();
    });
  });

  describe('конкурентность и производительность', () => {
    it('должен корректно обрабатывать конкурентные обновления разных постов', async () => {
      const { id: blogId }: Blog = await createTestBlog();
      const posts: Post[] = await Promise.all([
        createTestPost(blogId, { title: 'Post 1' }),
        createTestPost(blogId, { title: 'Post 2' }),
        createTestPost(blogId, { title: 'Post 3' }),
        createTestPost(blogId, { title: 'Post 4' }),
        createTestPost(blogId, { title: 'Post 5' }),
      ]);

      const updatePromises = posts.map((post, index) => {
        const updateDto: PostUpdateDto = {
          blogId,
          postId: post.id,
          title: `Updated Post ${index + 1}`,
          shortDescription: `Updated description ${index + 1}`,
          content: `Updated content ${index + 1}`,
        };
        return useCase.execute(new UpdatePostCommand(updateDto));
      });

      await Promise.all(updatePromises);

      const updatedPosts: (Post | null)[] = await Promise.all(
        posts.map((post) => postRepo.findOneBy({ id: post.id })),
      );

      updatedPosts.forEach((post, index) => {
        expect(post!.title).toBe(`Updated Post ${index + 1}`);
        expect(post!.shortDescription).toBe(`Updated description ${index + 1}`);
        expect(post!.content).toBe(`Updated content ${index + 1}`);
      });
    });

    it('должен корректно обрабатывать множественные последовательные обновления одного поста', async () => {
      const { id: blogId }: Blog = await createTestBlog();
      const { id: postId }: Post = await createTestPost(blogId);

      const updates = [
        {
          title: 'First Update',
          shortDescription: 'First description',
          content: 'First content',
        },
        {
          title: 'Second Update',
          shortDescription: 'Second description',
          content: 'Second content',
        },
        {
          title: 'Third Update',
          shortDescription: 'Third description',
          content: 'Third content',
        },
      ];

      for (const update of updates) {
        const updateDto: PostUpdateDto = {
          blogId,
          postId,
          ...update,
        };
        await useCase.execute(new UpdatePostCommand(updateDto));
      }

      const finalPost: Post | null = await postRepo.findOneBy({ id: postId });
      const lastUpdate = updates[updates.length - 1];
      expect(finalPost!.title).toBe(lastUpdate.title);
      expect(finalPost!.shortDescription).toBe(lastUpdate.shortDescription);
      expect(finalPost!.content).toBe(lastUpdate.content);
    });

    it('должен корректно работать при большой нагрузке', async () => {
      const { id: blogId }: Blog = await createTestBlog();
      const postCount = 1000;
      const posts: Post[] = await Promise.all(
        Array.from({ length: postCount }, (_, i) => createTestPost(blogId, { title: `Post ${i}` })),
      );

      const updatePromises = posts.map((post) => {
        const updateDto: PostUpdateDto = {
          blogId,
          postId: post.id,
          title: `Updated ${post.title}`,
          shortDescription: `Updated description for ${post.title}`,
          content: `Updated content for ${post.title}`,
        };
        return useCase.execute(new UpdatePostCommand(updateDto));
      });

      await expect(Promise.all(updatePromises)).resolves.not.toThrow();

      const updatedPostsCount: number = await postRepo.count();
      expect(updatedPostsCount).toBe(postCount);
    }, 15000);
  });

  describe('интеграция с repository', () => {
    it('должен правильно вызывать методы repository в нужном порядке', async () => {
      const { id: blogId }: Blog = await createTestBlog();
      const { id: postId }: Post = await createTestPost(blogId);

      const updateDto: PostUpdateDto = {
        blogId,
        postId,
        title: 'Spy Test Title',
        shortDescription: 'Spy test description',
        content: 'Spy test content',
      };

      const getBlogByIdSpy = jest.spyOn(blogsRepository, 'getById');
      const getPostByIdSpy = jest.spyOn(postsRepository, 'getById');
      const saveSpy = jest.spyOn(postsRepository, 'save');

      await useCase.execute(new UpdatePostCommand(updateDto));

      expect(getBlogByIdSpy).toHaveBeenCalledWith(updateDto.blogId);
      expect(getBlogByIdSpy).toHaveBeenCalledTimes(1);
      expect(getPostByIdSpy).toHaveBeenCalledWith(updateDto.postId);
      expect(getPostByIdSpy).toHaveBeenCalledTimes(1);
      expect(saveSpy).toHaveBeenCalledTimes(1);

      const getBlogCall: number = getBlogByIdSpy.mock.invocationCallOrder[0];
      const getPostCall: number = getPostByIdSpy.mock.invocationCallOrder[0];
      const saveCall: number = saveSpy.mock.invocationCallOrder[0];

      expect(getBlogCall).toBeLessThan(getPostCall);
      expect(getPostCall).toBeLessThan(saveCall);

      const saveCallArgs = saveSpy.mock.calls[0][0];
      expect(saveCallArgs).toBeInstanceOf(Post);
      expect(saveCallArgs.title).toBe(updateDto.title);
      expect(saveCallArgs.shortDescription).toBe(updateDto.shortDescription);
      expect(saveCallArgs.content).toBe(updateDto.content);

      getBlogByIdSpy.mockRestore();
      getPostByIdSpy.mockRestore();
      saveSpy.mockRestore();
    });

    it('не должен вызывать save если блог не найден', async () => {
      const nonExistentBlogId = 99999;
      const updateDto: PostUpdateDto = {
        blogId: nonExistentBlogId,
        postId: 1,
        title: 'Test Title',
        shortDescription: 'Test description',
        content: 'Test content',
      };

      const saveSpy = jest.spyOn(postsRepository, 'save');

      await expect(useCase.execute(new UpdatePostCommand(updateDto))).rejects.toThrow(
        DomainException,
      );

      expect(saveSpy).not.toHaveBeenCalled();
      saveSpy.mockRestore();
    });

    it('не должен вызывать save если пост не найден', async () => {
      const { id: blogId }: Blog = await createTestBlog();
      const nonExistentPostId = 99999;
      const updateDto: PostUpdateDto = {
        blogId,
        postId: nonExistentPostId,
        title: 'Test Title',
        shortDescription: 'Test description',
        content: 'Test content',
      };

      const saveSpy = jest.spyOn(postsRepository, 'save');

      await expect(useCase.execute(new UpdatePostCommand(updateDto))).rejects.toThrow(
        DomainException,
      );

      expect(saveSpy).not.toHaveBeenCalled();
      saveSpy.mockRestore();
    });

    it('не должен вызывать save если пост не принадлежит блогу', async () => {
      const { id: blogId_1 }: Blog = await createTestBlog();
      const { id: blogId_2 }: Blog = await createTestBlog();
      const { id: postId }: Post = await createTestPost(blogId_2);

      const updateDto: PostUpdateDto = {
        blogId: blogId_1,
        postId,
        title: 'Test Title',
        shortDescription: 'Test description',
        content: 'Test content',
      };

      const saveSpy = jest.spyOn(postsRepository, 'save');

      await expect(useCase.execute(new UpdatePostCommand(updateDto))).rejects.toThrow(
        DomainException,
      );

      expect(saveSpy).not.toHaveBeenCalled();
      saveSpy.mockRestore();
    });
  });
});
