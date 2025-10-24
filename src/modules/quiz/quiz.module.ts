import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Question } from './admin/domain/entities/question.entity';
import { UserAccountsModule } from '../user-accounts/user-accounts.module';
import { QuestionsAdminController } from './admin/api/questions-admin.controller';
import { QuestionsRepository } from './admin/infrastructure/questions-repository';
import { QuestionsQueryRepository } from './admin/infrastructure/query/questions-query-repository';
import { CreateQuestionUseCase } from './admin/application/usecases/create-question.usecase';

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
