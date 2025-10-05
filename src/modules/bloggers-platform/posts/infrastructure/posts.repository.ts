import { Injectable } from '@nestjs/common';
import { Post } from '../domain/entities/post.entity';
import { BaseRepository } from '../../../../core/repositories/base.repository';
import { DataSource } from 'typeorm';

@Injectable()
export class PostsRepository extends BaseRepository<Post> {
  constructor(dataSource: DataSource) {
    super(dataSource, Post);
  }
}
