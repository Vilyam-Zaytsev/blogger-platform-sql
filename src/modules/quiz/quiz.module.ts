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
import { GamesRepository } from './public/infrastructure/games.repository';
import { ConnectToGameUseCase } from './public/application/usecases/connect-to-game.usecase';
import { PlayersRepository } from './public/infrastructure/players.repository';
import { QuizPublicController } from './public/api/quiz-public.controller';
import { GamesQueryRepository } from './public/infrastructure/query/games.query-repository';
import { GameMatchingService } from './public/domain/services/game-matching.service';
import { GameStateService } from './public/domain/services/game-state.service';
import { GameQuestionsService } from './public/domain/services/game-questions.service';
import { PlayerValidationService } from './public/domain/services/player-validation.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Question, Game, GameQuestion, Player, Answer]),
    UserAccountsModule,
  ],
  controllers: [QuestionsAdminController, QuizPublicController],
  providers: [
    // 🔸 Questions:
    //repo
    QuestionsRepository,
    QuestionsQueryRepository,
    //use-cases
    CreateQuestionUseCase,

    // 🔸 Games:
    //repo
    GamesRepository,
    GamesQueryRepository,
    //use-cases
    ConnectToGameUseCase,
    //services
    GameMatchingService,
    GameQuestionsService,
    GameStateService,
    // 🔸 Players:
    //repo
    PlayersRepository,
    //services
    PlayerValidationService,
  ],
})
export class QuizModule {}
