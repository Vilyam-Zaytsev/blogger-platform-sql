import { Pool, QueryResult } from 'pg';
import { CreateBlogDto } from '../dto/create-blog.dto';
import { Inject } from '@nestjs/common';
import { PG_POOL } from '../../../database/constants/database.constants';
import { BlogDb } from '../types/blog-db.type';
import { UpdateBlogDto } from '../dto/update-blog.dto';
import { BaseRepository } from '../../../../core/repositories/base.repository';

export class BlogsRepository extends BaseRepository<BlogDb, CreateBlogDto, UpdateBlogDto> {
  constructor(@Inject(PG_POOL) pool: Pool) {
    super(pool, 'Blogs');
  }

  async create(dto: CreateBlogDto): Promise<number> {
    const query = `
      INSERT INTO "Blogs" ("name", "description", "websiteUrl", "isMembership")
      VALUES ($1, $2, $3, $4) RETURNING "id";
    `;
    //TODO: нормальный ли подход оборачивать все запросы в бд в try/catch для логирования ошибки?
    try {
      const { rows }: QueryResult<{ id: number }> = await this.pool.query(query, [
        dto.name,
        dto.description,
        dto.websiteUrl,
        dto.isMembership,
      ]);

      return rows[0].id;
    } catch (error) {
      console.error('Ошибка при выполнении SQL-запроса в BlogsRepository.create():', error);

      throw error;
    }
  }

  async update(dto: UpdateBlogDto): Promise<boolean> {
    const query = `
    UPDATE "Blogs"
    SET "name"        = $1,
        "description" = $2,
        "websiteUrl"  = $3
    WHERE "id" = $4
  `;

    //TODO: нормальный ли подход оборачивать все запросы в бд в try/catch для логирования ошибки?
    try {
      const { rowCount }: QueryResult = await this.pool.query(query, [
        dto.name,
        dto.description,
        dto.websiteUrl,
        dto.id,
      ]);

      return rowCount !== null && rowCount > 0;
    } catch (error) {
      console.error('Ошибка при выполнении SQL-запроса в BlogsRepository.update():', error);

      throw error;
    }
  }
}
