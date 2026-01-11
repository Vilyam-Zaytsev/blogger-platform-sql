import { Injectable } from '@nestjs/common';
import { Post } from '../domain/entities/post.entity';
import { BaseRepository } from '../../../../core/repositories/base.repository';
import { TransactionHelper } from '../../../../trasaction.helper';

@Injectable()
export class PostsRepository extends BaseRepository<Post> {
  constructor(protected readonly transactionHelper: TransactionHelper) {
    super(Post, transactionHelper);
  }
}
