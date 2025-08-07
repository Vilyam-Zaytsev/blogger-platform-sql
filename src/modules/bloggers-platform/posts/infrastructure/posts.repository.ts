import { Inject, Injectable } from '@nestjs/common';
import { PG_POOL } from '../../../database/constants/database.constants';
import { Pool, QueryResult } from 'pg';
import { PostDbType } from '../types/post-db.type';
import { CreatePostDto } from '../dto/create-post.dto';
import { DomainException } from '../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../core/exceptions/domain-exception-codes';
import { UpdatePostDto } from '../dto/update-post.dto';

@Injectable()
export class PostsRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async getByIdOrNotFoundFail(id: number): Promise<PostDbType> {
    const { rows }: QueryResult<PostDbType> = await this.pool.query(
      `
        SELECT *
        FROM "Posts"
        WHERE "id" = $1
          AND "deletedAt" IS NULL
      `,
      [id],
    );

    if (rows.length === 0) {
      throw new DomainException({
        code: DomainExceptionCode.NotFound,
        message: `The post with ID (${id}) does not exist`,
      });
    }

    return rows[0];
  }

  async insertPost(dto: CreatePostDto): Promise<number> {
    const { rows }: QueryResult<PostDbType> = await this.pool.query(
      `
        INSERT INTO "Posts" ("title", "shortDescription", "content", "blogId")
        VALUES ($1, $2, $3, $4) RETURNING "id"
      `,
      [dto.title, dto.shortDescription, dto.content, dto.blogId],
    );

    return rows[0].id;
  }

  async updatePost(dto: UpdatePostDto) {
    await this.pool.query(
      `
        UPDATE "Posts"
        SET "title"            = $1,
            "shortDescription" = $2,
            "content"          = $3
        WHERE "id" = $4
      `,
      [dto.title, dto.shortDescription, dto.content],
    );
  }

  async softDelete(id: number): Promise<boolean> {
    const { rowCount }: QueryResult = await this.pool.query(
      `
      UPDATE "Posts"
      SET "deletedAt" = NOW()
      WHERE "id" = $1
      AND "deletedAt" IS NULL
      `,
      [id],
    );

    return rowCount === 1;
  }
}
