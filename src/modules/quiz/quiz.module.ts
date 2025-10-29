import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Question } from './admin/domain/entities/question.entity';
import { UserAccountsModule } from '../user-accounts/user-accounts.module';
import { QuestionsAdminController } from './admin/api/questions-admin.controller';
import { QuestionsRepository } from './admin/infrastructure/questions-repository';
import { QuestionsQueryRepository } from './admin/infrastructure/query/questions-query-repository';
import { CreateQuestionUseCase } from './admin/application/usecases/create-question.usecase';
import { Game } from './public/domain/entities/game.entity';
import { GameQuestion } from './public/domain/entities/game-question.entity';
import { Player } from './public/domain/entities/player.entity';
import { Answer } from './public/domain/entities/answer.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Question, Game, GameQuestion, Player, Answer]),
    UserAccountsModule,
  ],
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
