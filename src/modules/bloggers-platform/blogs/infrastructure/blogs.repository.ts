import { Pool, QueryResult } from 'pg';
import { CreateBlogDto } from '../dto/create-blog.dto';
import { Inject } from '@nestjs/common';
import { PG_POOL } from '../../../database/constants/database.constants';
import { BlogDbType } from '../types/blog-db.type';
import { DomainException } from '../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../core/exceptions/domain-exception-codes';
import { UpdateBlogDto } from '../dto/update-blog.dto';

export class BlogsRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async insertBlog(dto: CreateBlogDto): Promise<number> {
    const { rows }: QueryResult<{ id: number }> = await this.pool.query(
      `
        INSERT INTO "Blogs" ("name", "description", "websiteUrl", "isMembership")
          VALUES ($1, $2, $3, $4) RETURNING "id";
      `,
      [dto.name, dto.description, dto.websiteUrl, dto.isMembership],
    );

    return rows[0].id;
  }

  async getByIdOrNotFoundFail(id: number): Promise<BlogDbType> {
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

    return rows[0];
  }

  async updateBlog(dto: UpdateBlogDto): Promise<boolean> {
    const { rowCount }: QueryResult = await this.pool.query(
      `
        UPDATE "Blogs"
        SET "name"        = $1,
            "description" = $2,
            "websiteUrl"  = $3
        WHERE "id" = $4
      `,
      [dto.name, dto.description, dto.websiteUrl, dto.id],
    );

    return rowCount !== null && rowCount > 0;
  }

  async softDelete(id: number): Promise<boolean> {
    const { rowCount }: QueryResult = await this.pool.query(
      `
        UPDATE "Blogs"
        SET "deletedAt" = NOW()
        WHERE id = $1
          AND "deletedAt" IS NULL
      `,
      [id],
    );

    return rowCount === 1;
  }
}
