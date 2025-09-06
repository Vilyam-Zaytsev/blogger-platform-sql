import { Pool, QueryResult } from 'pg';
import { CreateBlogDto } from '../dto/create-blog.dto';
import { Inject } from '@nestjs/common';
import { PG_POOL } from '../../../database/constants/database.constants';
import { BlogDb } from '../types/blog-db.type';
import { UpdateBlogDto } from '../dto/update-blog.dto';
import { BaseRepository } from '../../../../core/repositories/base.repository';
import { InjectRepository } from '@nestjs/typeorm';
import { Blog } from '../domain/entities/blog.entity';
import { Repository } from 'typeorm';

export class BlogsRepository extends BaseRepository<BlogDb, CreateBlogDto, UpdateBlogDto> {
  constructor(
    @InjectRepository(Blog) private readonly blogs: Repository<Blog>,
    @Inject(PG_POOL) pool: Pool,
  ) {
    super(pool, 'Blogs');
  }

  async save(blog: Blog): Promise<number> {
    const { id }: Blog = await this.blogs.save(blog);

    return id;
  }

  async create(dto: CreateBlogDto): Promise<number> {
    const query = `
      INSERT INTO "Blogs" ("name", "description", "websiteUrl", "isMembership")
      VALUES ($1, $2, $3, $4) RETURNING "id";
    `;

    const { rows }: QueryResult<{ id: number }> = await this.pool.query(query, [
      dto.name,
      dto.description,
      dto.websiteUrl,
      dto.isMembership,
    ]);

    return rows[0].id;
  }

  async update(dto: UpdateBlogDto): Promise<void> {
    const query = `
    UPDATE "Blogs"
    SET "name"        = $1,
        "description" = $2,
        "websiteUrl"  = $3
    WHERE "id" = $4
  `;

    await this.pool.query(query, [dto.name, dto.description, dto.websiteUrl, dto.id]);
  }
}
