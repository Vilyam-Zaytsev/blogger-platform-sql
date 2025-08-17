import { Inject, Injectable } from '@nestjs/common';
import { PG_POOL } from '../../../database/constants/database.constants';
import { Pool, QueryResult } from 'pg';
import { CommentDb } from '../types/comment-db.type';
import { UpdateCommentContentDto } from './dto/update-comment-content.dto';
import { CreateCommentDomainDto } from '../domain/dto/create-comment.domain-dto';
import { BaseRepository } from '../../../../core/repositories/base.repository';

@Injectable()
export class CommentsRepository extends BaseRepository<
  CommentDb,
  CreateCommentDomainDto,
  UpdateCommentContentDto
> {
  constructor(@Inject(PG_POOL) pool: Pool) {
    super(pool, 'Comments');
  }

  async create(dto: CreateCommentDomainDto): Promise<number> {
    const query = `
      INSERT INTO "Comments" ("postId", "commentatorId", "content")
      VALUES ($1, $2, $3) RETURNING "id";
    `;
    //TODO: нормальный ли подход оборачивать все запросы в бд в try/catch для логирования ошибки?
    try {
      const { rows }: QueryResult<{ id: number }> = await this.pool.query(query, [
        dto.postId,
        dto.commentatorId,
        dto.content,
      ]);

      return rows[0].id;
    } catch (error) {
      console.error('Ошибка при выполнении SQL-запроса в CommentsRepository.create():', error);

      throw error;
    }
  }

  async update(dto: UpdateCommentContentDto): Promise<boolean> {
    const query = `
      UPDATE "Comments"
      SET "content" = $1
      WHERE "id" = $2
    `;

    //TODO: нормальный ли подход оборачивать все запросы в бд в try/catch для логирования ошибки?
    try {
      const { rowCount }: QueryResult = await this.pool.query(query, [dto.content, dto.commentId]);

      return rowCount !== null && rowCount > 0;
    } catch (error) {
      console.error('Ошибка при выполнении SQL-запроса в CommentsRepository.update():', error);

      throw error;
    }
  }
}
