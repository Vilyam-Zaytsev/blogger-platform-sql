import { Injectable } from '@nestjs/common';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';
import { GetBlogsQueryParams } from '../../api/input-dto/get-blogs-query-params.input-dto';
import { PaginatedViewDto } from '../../../../../core/dto/paginated.view-dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Blog } from '../../domain/entities/blog.entity';
import { Repository } from 'typeorm';
import { BlogViewDto } from '../../api/view-dto/blog.view-dto';

@Injectable()
export class BlogsQueryRepository {
  constructor(@InjectRepository(Blog) private readonly repository: Repository<Blog>) {}

  //TODO: нормально ли в одном репо использовать и репозиторий и qb

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

    const qb = this.repository.createQueryBuilder('blog');

    if (searchNameTerm) {
      qb.andWhere('blog.name ILIKE :name', { name: `%${searchNameTerm}%` });
    }

    qb.orderBy(`blog.${sortBy}`, sortDirection.toUpperCase() as 'ASC' | 'DESC');
    qb.skip(skip).take(pageSize);

    const [users, totalCount] = await qb.getManyAndCount();
    const pagesCount = Math.ceil(totalCount / pageSize);

    return {
      pagesCount,
      page: pageNumber,
      pageSize,
      totalCount,
      items: users.map((blog) => BlogViewDto.mapToView(blog)),
    };
  }
}
