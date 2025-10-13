import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Question } from './domain/entities/question.entity';
import { UserAccountsModule } from '../user-accounts/user-accounts.module';
import { QuestionAdminController } from './api/question-admin.controller';
import { QuestionRepository } from './infrastructure/question.repository';
import { QuestionQueryRepository } from './infrastructure/query/question.query-repository';
import { CreateQuestionUseCase } from './application/usecases/create-question.usecase';

@Module({
  imports: [TypeOrmModule.forFeature([Question]), UserAccountsModule],
  controllers: [QuestionAdminController],
  providers: [
    //🔸 Questions:
    //repo
    QuestionRepository,
    QuestionQueryRepository,
    //use-cases
    CreateQuestionUseCase,
  ],
})
export class QuizModule {}
