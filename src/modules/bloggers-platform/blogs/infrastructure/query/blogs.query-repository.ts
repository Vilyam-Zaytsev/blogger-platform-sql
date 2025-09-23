import { Injectable } from '@nestjs/common';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';
import { GetBlogsQueryParams } from '../../api/input-dto/get-blogs-query-params.input-dto';
import { PaginatedViewDto } from '../../../../../core/dto/paginated.view-dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Blog } from '../../domain/entities/blog.entity';
import { Repository } from 'typeorm';
import { BlogViewDto } from '../../api/view-dto/blog.view-dto';
import { RawBlog } from '../dto/raw-blog.type';

@Injectable()
export class BlogsQueryRepository {
  constructor(@InjectRepository(Blog) private readonly repository: Repository<Blog>) {}

  async getByIdOrNotFoundFail(id: number): Promise<BlogViewDto> {
    const blog: Blog | null = await this.repository.findOneBy({ id });

    if (!blog) {
      throw new DomainException({
        code: DomainExceptionCode.NotFound,
        message: `The blog with ID (${id}) does not exist`,
      });
    }

    return BlogViewDto.mapToView(blog);
  }

  async getAll(queryParams: GetBlogsQueryParams): Promise<PaginatedViewDto<BlogViewDto>> {
    const { sortBy, sortDirection, pageSize, pageNumber, searchNameTerm }: GetBlogsQueryParams =
      queryParams;
    const skip: number = queryParams.calculateSkip();

    const qb = this.repository
      .createQueryBuilder('blog')
      .select([
        'blog.id AS "id"',
        'blog.name AS "name"',
        'blog.description AS "description"',
        'blog.websiteUrl AS "websiteUrl"',
        'blog.createdAt AS "createdAt"',
        'blog.isMembership AS "isMembership"',
      ]);

    if (searchNameTerm) {
      qb.andWhere('blog.name ILIKE :name', { name: `%${searchNameTerm}%` });
    }

    qb.orderBy(`blog.${sortBy}`, sortDirection.toUpperCase() as 'ASC' | 'DESC');
    qb.skip(skip).take(pageSize);

    const rawBlogs: RawBlog[] = await qb.getRawMany();
    const totalCount: number = await qb.getCount();
    const pagesCount: number = Math.ceil(totalCount / pageSize);

    return {
      pagesCount,
      page: pageNumber,
      pageSize,
      totalCount,
      items: rawBlogs.map((blog) => BlogViewDto.mapToView(blog)),
    };
  }
}
