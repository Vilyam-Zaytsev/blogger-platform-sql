import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../../../core/repositories/base.repository';
import { Comment } from '../domain/entities/comment.entity';
import { DataSource } from 'typeorm';

@Injectable()
export class CommentsRepository extends BaseRepository<Comment> {
  constructor(dataSource: DataSource) {
    super(dataSource, Comment);
  }
}
