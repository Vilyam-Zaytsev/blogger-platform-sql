import { Inject, Injectable } from '@nestjs/common';
import { PG_POOL } from '../../../database/constants/database.constants';
import { Pool, QueryResult } from 'pg';
import { PostDb } from '../types/post-db.type';
import { CreatePostDto } from '../dto/create-post.dto';
import { UpdatePostDto } from '../dto/update-post.dto';
import { BaseRepository } from '../../../../core/repositories/base.repository';

@Injectable()
export class PostsRepository extends BaseRepository<PostDb, CreatePostDto, UpdatePostDto> {
  constructor(@Inject(PG_POOL) pool: Pool) {
    super(pool, 'Posts');
  }

  async create(dto: CreatePostDto): Promise<number> {
    const query = `
      INSERT INTO "Posts" ("title", "shortDescription", "content", "blogId")
      VALUES ($1, $2, $3, $4) RETURNING "id"
    `;

    //TODO: нормальный ли подход оборачивать все запросы в бд в try/catch для логирования ошибки?
    try {
      const { rows }: QueryResult<PostDb> = await this.pool.query(query, [
        dto.title,
        dto.shortDescription,
        dto.content,
        dto.blogId,
      ]);

      return rows[0].id;
    } catch (error) {
      console.error('Ошибка при выполнении SQL-запроса в PostsRepository.create():', error);

      throw error;
    }
  }

  async update(dto: UpdatePostDto): Promise<boolean> {
    const query = `
      UPDATE "Posts"
      SET "title"            = $1,
          "shortDescription" = $2,
          "content"          = $3
      WHERE "id" = $4
    `;

    //TODO: нормальный ли подход оборачивать все запросы в бд в try/catch для логирования ошибки?
    try {
      const { rowCount }: QueryResult = await this.pool.query(query, [
        dto.title,
        dto.shortDescription,
        dto.content,
        dto.postId,
      ]);

      return rowCount !== null && rowCount > 0;
    } catch (error) {
      console.error('Ошибка при выполнении SQL-запроса в PostsRepository.create():', error);

      throw error;
    }
  }
}
