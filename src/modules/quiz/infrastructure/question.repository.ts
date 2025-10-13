import { BaseRepository } from '../../../core/repositories/base.repository';
import { Question } from '../domain/entities/question.entity';
import { DataSource } from 'typeorm';
import { Injectable } from '@nestjs/common';

@Injectable()
export class QuestionRepository extends BaseRepository<Question> {
  constructor(dataSource: DataSource) {
    super(dataSource, Question);
  }
}
