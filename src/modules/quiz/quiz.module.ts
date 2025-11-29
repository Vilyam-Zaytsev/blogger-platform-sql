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
import { RecordAnswerUseCase } from './public/application/usecases/record-answer.usecase';
import { GetQuestionQueryHandler } from './admin/application/queries/get-questions.query-handler';
import { GetCurrentGameQueryHandler } from './public/application/queries/get-current-game.query-handler';
import { GetGameQueryHandler } from './public/application/queries/get-game.query-handler';
import { PublishQuestionUseCase } from './admin/application/usecases/publish-question.usecase';
import { RemovePublicationQuestionUseCase } from './admin/application/usecases/remove-publication-question.usecase';
import { UpdateQuestionUseCase } from './admin/application/usecases/update-question.usecase';
import { DeleteQuestionUseCase } from './admin/application/usecases/delete-question.usecase';
import { QuestionValidatorService } from './admin/domain/services/question-validator.service';
import { GetAllGamesForUserQueryHandler } from './public/application/queries/get-all-games-for-user.query-handler';
import { GetMyStatisticQueryHandler } from './public/application/queries/get-satistic-for-user.query-handler';

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
    PublishQuestionUseCase,
    RemovePublicationQuestionUseCase,
    UpdateQuestionUseCase,
    DeleteQuestionUseCase,
    //query-handlers
    GetQuestionQueryHandler,
    //services
    QuestionValidatorService,

    // 🔸 Games:
    //repo
    GamesRepository,
    GamesQueryRepository,
    //use-cases
    ConnectToGameUseCase,
    RecordAnswerUseCase,
    //query-handlers
    GetCurrentGameQueryHandler,
    GetGameQueryHandler,
    GetAllGamesForUserQueryHandler,
    GetMyStatisticQueryHandler,

    // 🔸 Players:
    //repo
    PlayersRepository,
  ],
})
export class QuizModule {}
