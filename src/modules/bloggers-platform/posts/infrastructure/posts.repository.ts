import { Inject, Injectable } from '@nestjs/common';
import { PG_POOL } from '../../../database/constants/database.constants';
import { Pool, QueryResult } from 'pg';
import { PostDbType } from '../types/post-db.type';
import { CreatePostDomainDto } from '../domain/dto/create-post.domain.dto';

@Injectable()
export class PostsRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  // async getByIdOrNotFoundFail(id: string): Promise<PostDocument> {
  //   const post: PostDocument | null = await this.PostModel.findOne({
  //     _id: id,
  //     deletedAt: null,
  //   });
  //
  //   if (!post) {
  //     throw new DomainException({
  //       code: DomainExceptionCode.NotFound,
  //       message: `The post with ID (${id}) does not exist`,
  //     });
  //   }
  //
  //   return post;
  // }

  async insertPost(dto: CreatePostDomainDto): Promise<number> {
    const { rows }: QueryResult<PostDbType> = await this.pool.query(
      `
        INSERT INTO "Posts" ("title", "shortDescription", "content", "blogId", "blogName")
        VALUES ($1, $2, $3, $4, $5) RETURNING "id"
      `,
      [dto.title, dto.shortDescription, dto.content, dto.blogId, dto.blogName],
    );

    return rows[0].id;
  }
}
