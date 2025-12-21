import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../../../core/repositories/base.repository';
import { Comment } from '../domain/entities/comment.entity';
import { TransactionHelper } from '../../../database/trasaction.helper';

@Injectable()
export class CommentsRepository extends BaseRepository<Comment> {
  constructor(protected readonly transactionHelper: TransactionHelper) {
    super(Comment, transactionHelper);
  }
}
