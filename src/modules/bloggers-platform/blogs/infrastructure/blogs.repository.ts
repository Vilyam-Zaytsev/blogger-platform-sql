import { Pool, QueryResult } from 'pg';
import { CreateBlogDto } from '../dto/blog.dto';
import { Inject } from '@nestjs/common';
import { PG_POOL } from '../../../database/constants/database.constants';
import { BlogDbType } from '../types/blog-db.type';

export class BlogsRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async insertBlog(dto: CreateBlogDto): Promise<number> {
    const { rows }: QueryResult<BlogDbType> = await this.pool.query(
      `
        INSERT INTO "Blogs" ("name", "description", "websiteUrl")
          VVALUES ($1, $2 $3) RETURNING "id";
      `,
      [dto.name, dto.description, dto.websiteUrl],
    );

    return rows[0].id;
  }

  // async getByIdOrNotFoundFail(id: string): Promise<BlogDocument> {
  //   const blog: BlogDocument | null = await this.BlogModel.findOne({
  //     _id: id,
  //     deletedAt: null,
  //   });
  //
  //   if (!blog) {
  //     throw new DomainException({
  //       code: DomainExceptionCode.NotFound,
  //       message: `The blog with ID (${id}) does not exist`,
  //     });
  //   }
  //
  //   return blog;
  // }
  //
  // async save(blog: BlogDocument): Promise<string> {
  //   const resultSave: BlogDocument = await blog.save();
  //
  //   return resultSave._id.toString();
  // }
}
