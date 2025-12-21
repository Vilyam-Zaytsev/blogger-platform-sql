import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../../../core/repositories/base.repository';
import { Blog } from '../domain/entities/blog.entity';
import { TransactionHelper } from '../../../database/trasaction.helper';

@Injectable()
export class BlogsRepository extends BaseRepository<Blog> {
  constructor(protected readonly transactionHelper: TransactionHelper) {
    super(Blog, transactionHelper);
  }
}
