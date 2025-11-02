import { BaseRepository } from '../../../../core/repositories/base.repository';
import { Question, QuestionStatus } from '../domain/entities/question.entity';
import { DataSource } from 'typeorm';
import { Injectable } from '@nestjs/common';

@Injectable()
export class QuestionsRepository extends BaseRepository<Question> {
  constructor(dataSource: DataSource) {
    super(dataSource, Question);
  }

  async getRandomPublishedQuestions(count: number): Promise<Question[]> {
    return this.repository
      .createQueryBuilder('q')
      .where('q.status = :status', { status: QuestionStatus.Published })
      .orderBy('RANDOM()')
      .take(count)
      .getMany();
  }
}
