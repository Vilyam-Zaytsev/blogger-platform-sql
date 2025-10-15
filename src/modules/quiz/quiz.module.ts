import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Question } from './domain/entities/question.entity';
import { UserAccountsModule } from '../user-accounts/user-accounts.module';
import { QuestionsAdminController } from './api/questions-admin.controller';
import { QuestionsRepository } from './infrastructure/questions-repository';
import { QuestionsQueryRepository } from './infrastructure/query/questions-query-repository';
import { CreateQuestionUseCase } from './application/usecases/create-question.usecase';

@Module({
  imports: [TypeOrmModule.forFeature([Question]), UserAccountsModule],
  controllers: [QuestionsAdminController],
  providers: [
    //🔸 Questions:
    //repo
    QuestionsRepository,
    QuestionsQueryRepository,
    //use-cases
    CreateQuestionUseCase,
  ],
})
export class QuizModule {}
