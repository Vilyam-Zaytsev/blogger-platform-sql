import { BaseRepository } from '../../../../core/repositories/base.repository';
import { Reaction } from '../domain/entities/reaction.entity';
import { DataSource } from 'typeorm';
import { Injectable } from '@nestjs/common';

@Injectable()
export class ReactionsRepository extends BaseRepository<Reaction> {
  constructor(dataSource: DataSource) {
    super(dataSource, Reaction);
  }

  async getByUserIdAndPostId(userId: number, postId: number): Promise<Reaction | null> {
    return this.dataSource.getRepository<Reaction>(Reaction).findOne({
      where: {
        userId,
        reactionPost: { postId },
      },
      relations: ['reactionPost'],
    });
  }
}
