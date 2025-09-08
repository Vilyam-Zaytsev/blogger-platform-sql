import { BaseRepository } from '../../../../core/repositories/base.repository';
import { Blog } from '../domain/entities/blog.entity';
import { DataSource } from 'typeorm';

export class BlogsRepository extends BaseRepository<Blog> {
  constructor(dataSource: DataSource) {
    super(dataSource, Blog);
  }
}
