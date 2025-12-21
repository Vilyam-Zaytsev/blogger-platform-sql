import { BaseRepository } from '../../../../core/repositories/base.repository';
import { Reaction } from '../domain/entities/reaction.entity';
import { Injectable } from '@nestjs/common';
import { TransactionHelper } from '../../../database/trasaction.helper';

@Injectable()
export class ReactionsRepository extends BaseRepository<Reaction> {
  constructor(protected readonly transactionHelper: TransactionHelper) {
    super(Reaction, transactionHelper);
  }

  async getByUserIdAndPostId(userId: number, postId: number): Promise<Reaction | null> {
    return this.getRepository().findOne({
      where: {
        userId,
        reactionPost: { postId },
      },
      relations: ['reactionPost'],
    });
  }

  async getByUserIdAndCommentId(userId: number, commentId: number): Promise<Reaction | null> {
    return this.getRepository().findOne({
      where: {
        userId,
        reactionComment: { commentId },
      },
      relations: ['reactionComment'],
    });
  }
}
