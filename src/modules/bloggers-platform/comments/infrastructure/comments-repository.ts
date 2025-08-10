import { Inject, Injectable } from '@nestjs/common';
import { DomainExceptionCode } from '../../../../core/exceptions/domain-exception-codes';
import { PG_POOL } from '../../../database/constants/database.constants';
import { Pool, QueryResult } from 'pg';
import { CommentDbType } from '../types/comment-db.type';
import { DomainException } from '../../../../core/exceptions/domain-exceptions';
import { UpdateCommentContentDto } from './dto/update-comment-content.dto';
import { CreateCommentDomainDto } from '../domain/dto/create-comment.domain-dto';

@Injectable()
export class CommentsRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async insertComment(dto: CreateCommentDomainDto): Promise<number> {
    const { rows }: QueryResult<{ id: number }> = await this.pool.query(
      `
      INSERT INTO "Comments" ("postId", "commentatorId", "content")
      VALUES ($1, $2, $3) RETURNING "id";
      `,
      [dto.postId, dto.commentatorId, dto.content],
    );

    return rows[0].id;
  }

  async getByIdOrNotFoundFail(id: number): Promise<CommentDbType> {
    const { rows }: QueryResult<CommentDbType> = await this.pool.query(
      `
        SELECT *
        FROM "Comments"
        WHERE "id" = $1
          AND "deletedAt" IS NULL
      `,
      [id],
    );

    if (rows.length === 0) {
      throw new DomainException({
        code: DomainExceptionCode.NotFound,
        message: `The comment with ID (${id}) does not exist`,
      });
    }

    return rows[0];
  }

  async updateContent(dto: UpdateCommentContentDto): Promise<void> {
    await this.pool.query(
      `
        UPDATE "Comments"
        SET "content" = $1
        WHERE "id" = $2
      `,
      [dto.content, dto.commentId],
    );
  }

  async softDelete(id: number): Promise<void> {
    await this.pool.query(
      `
        UPDATE "Comments"
        SET "deletedAt" = NOW()
        WHERE "id" = $1
          AND "deletedAt" IS NULL
      `,
      [id],
    );
  }
}
