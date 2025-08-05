import { Inject, Injectable } from '@nestjs/common';
import { BlogViewDto } from '../../api/view-dto/blog-view.dto';
import { Pool, QueryResult } from 'pg';
import { PG_POOL } from '../../../../database/constants/database.constants';
import { BlogDbType } from '../../types/blog-db.type';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';

@Injectable()
export class BlogsQueryRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async getByIdOrNotFoundFail(id: number): Promise<BlogViewDto> {
    const { rows }: QueryResult<BlogDbType> = await this.pool.query(
      `
        SELECT *
        FROM "Blogs"
        WHERE "id" = $1
          AND "deletedAt" IS NULL
      `,
      [id],
    );

    if (rows.length === 0) {
      throw new DomainException({
        code: DomainExceptionCode.NotFound,
        message: `The blog with ID (${id}) does not exist`,
      });
    }

    return BlogViewDto.mapToView(rows[0]);
  }

  // async getAll(
  //   query: GetBlogsQueryParams,
  // ): Promise<PaginatedViewDto<BlogViewDto>> {
  //   const filter: FilterQuery<Blog> = {
  //     deletedAt: null,
  //   };
  //
  //   if (query.searchNameTerm) {
  //     filter.$or = filter.$or || [];
  //     filter.$or.push({
  //       name: { $regex: query.searchNameTerm, $options: 'i' },
  //     });
  //   }
  //
  //   const blogs: BlogDocument[] = await this.BlogModel.find(filter)
  //     .sort({ [query.sortBy]: query.sortDirection })
  //     .skip(query.calculateSkip())
  //     .limit(query.pageSize);
  //
  //   const totalCount: number = await this.BlogModel.countDocuments(filter);
  //
  //   const items: BlogViewDto[] = blogs.map(
  //     (blog: BlogDocument): BlogViewDto => BlogViewDto.mapToView(blog),
  //   );
  //
  //   return PaginatedViewDto.mapToView<BlogViewDto>({
  //     items,
  //     totalCount,
  //     page: query.pageNumber,
  //     size: query.pageSize,
  //   });
  // }
}
