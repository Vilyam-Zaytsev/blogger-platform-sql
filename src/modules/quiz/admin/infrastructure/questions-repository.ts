import { BaseRepository } from '../../../../core/repositories/base.repository';
import { Question, QuestionStatus } from '../domain/entities/question.entity';
import { Injectable } from '@nestjs/common';
import { TransactionHelper } from '../../../../trasaction.helper';

@Injectable()
export class QuestionsRepository extends BaseRepository<Question> {
  constructor(protected readonly transactionHelper: TransactionHelper) {
    super(Question, transactionHelper);
  }
  async getRandomPublishedQuestions(count: number): Promise<Question[]> {
    return this.getRepository()
      .createQueryBuilder('q')
      .where('q.status = :status', { status: QuestionStatus.Published })
      .orderBy('RANDOM()')
      .take(count)
      .getMany();
  }

  async getByPublicId(publicId: string): Promise<Question | null> {
    return this.getRepository().findOne({
      where: { publicId },
    });
  }
}
