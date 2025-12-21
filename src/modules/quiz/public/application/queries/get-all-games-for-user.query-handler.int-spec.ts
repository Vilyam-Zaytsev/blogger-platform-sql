// src/modules/quiz/public/application/queries/get-all-games-for-user.query-handler.int-spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, Repository } from 'typeorm';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  GetAllGamesForUserQuery,
  GetAllGamesForUserQueryHandler,
} from './get-all-games-for-user.query-handler';

import { DatabaseModule } from '../../../../database/database.module';
import { configModule } from '../../../../../dynamic-config.module';

import { Game, GameStatus } from '../../domain/entities/game.entity';
import { GameRole, Player } from '../../domain/entities/player.entity';
import { GameQuestion } from '../../domain/entities/game-question.entity';
import { Question } from '../../../admin/domain/entities/question.entity';
import { Answer, AnswerStatus } from '../../domain/entities/answer.entity';
import { User } from '../../../../user-accounts/users/domain/entities/user.entity';

import { GamesQueryRepository } from '../../infrastructure/query/games.query-repository';
import { PlayersRepository } from '../../infrastructure/players.repository';
import { QuestionInputDto } from '../../../admin/api/input-dto/question.input-dto';
import { GameQuestionCreateDto } from '../../domain/dto/game-question.create-dto';
import { getRelatedEntities } from '../../../../../core/utils/get-related-entities.utility';
import { UserInputDto } from '../../../../user-accounts/users/api/input-dto/user.input-dto';
import { CreateUserDto } from '../../../../user-accounts/users/dto/create-user.dto';
import { UsersFactory } from '../../../../user-accounts/users/application/factories/users.factory';
import { CryptoService } from '../../../../user-accounts/users/application/services/crypto.service';
import { DateService } from '../../../../user-accounts/users/application/services/date.service';
import {
  GamesSortBy,
  GetGamesQueryParams,
} from '../../api/input-dto/get-games-query-params.input-dto';
import { PaginatedViewDto } from '../../../../../core/dto/paginated.view-dto';
import { GameViewDto } from '../../api/view-dto/game.view-dto';
import { AnswerCreateDto } from '../../domain/dto/answer.create-dto';
import { SortDirection } from '../../../../../core/dto/base.query-params.input-dto';
import { REQUIRED_QUESTIONS_COUNT } from '../../domain/constants/game.constants';
import { TransactionHelper } from '../../../../database/trasaction.helper';

describe('GetAllGamesForUserQueryHandler (Integration)', () => {
  let module: TestingModule;
  let dataSource: DataSource;

  let queryHandler: GetAllGamesForUserQueryHandler;
  let usersFactory: UsersFactory;

  let gameRepo: Repository<Game>;
  let playerRepo: Repository<Player>;
  let questionRepo: Repository<Question>;
  let gameQuestionRepo: Repository<GameQuestion>;
  let answerRepo: Repository<Answer>;
  let userRepo: Repository<User>;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [configModule, DatabaseModule, TypeOrmModule.forFeature(getRelatedEntities(Game))],
      providers: [
        GetAllGamesForUserQueryHandler,

        UsersFactory,
        CryptoService,
        DateService,

        GamesQueryRepository,
        PlayersRepository,

        TransactionHelper,
      ],
    }).compile();

    dataSource = module.get<DataSource>(DataSource);
    usersFactory = module.get<UsersFactory>(UsersFactory);
    queryHandler = module.get<GetAllGamesForUserQueryHandler>(GetAllGamesForUserQueryHandler);

    gameRepo = dataSource.getRepository(Game);
    playerRepo = dataSource.getRepository(Player);
    questionRepo = dataSource.getRepository(Question);
    gameQuestionRepo = dataSource.getRepository(GameQuestion);
    answerRepo = dataSource.getRepository(Answer);
    userRepo = dataSource.getRepository(User);
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE TABLE answers RESTART IDENTITY CASCADE');
    await dataSource.query('TRUNCATE TABLE game_questions RESTART IDENTITY CASCADE');
    await dataSource.query('TRUNCATE TABLE players RESTART IDENTITY CASCADE');
    await dataSource.query('TRUNCATE TABLE games RESTART IDENTITY CASCADE');
    await dataSource.query('TRUNCATE TABLE questions RESTART IDENTITY CASCADE');
    await dataSource.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
  });

  afterAll(async () => {
    await dataSource.destroy();
    await module.close();
  });

  const createTestUser = async (userData?: Partial<UserInputDto>): Promise<User> => {
    const dto: CreateUserDto = {
      login: 'test_user',
      email: 'test_user@example.com',
      password: 'qwerty',
      ...userData,
    };

    const user: User = await usersFactory.create(dto);
    return await userRepo.save(user);
  };

  const createTestPublishedQuestion = async (
    questionData?: Partial<QuestionInputDto>,
  ): Promise<Question> => {
    const defaultData: QuestionInputDto = {
      body: 'What is the capital of France?',
      correctAnswers: ['Paris'],
      ...questionData,
    };

    const question: Question = Question.create(defaultData);
    question.publish();
    return await questionRepo.save(question);
  };

  const createMultiplePublishedQuestions = async (count: number): Promise<Question[]> => {
    const questions: Question[] = [];

    for (let i = 0; i < count; i++) {
      const question: Question = await createTestPublishedQuestion({
        body: `Test question ${i + 1}: What is the answer to question ${i + 1}?`,
        correctAnswers: [`Answer ${i + 1}`, `Correct ${i + 1}`],
      });
      questions.push(question);
    }

    return questions;
  };

  const createPendingGameWithOnePlayer = async (
    userId: number,
    createdAt?: Date,
  ): Promise<{ game: Game; player: Player }> => {
    const game: Game = Game.create();
    if (createdAt) {
      game.createdAt = createdAt;
    }
    const createdGame: Game = await gameRepo.save(game);

    const player: Player = Player.create(userId, createdGame.id);
    player.updateRole(GameRole.Host);
    const createdPlayer: Player = await playerRepo.save(player);

    return { game: createdGame, player: createdPlayer };
  };

  const createActiveGameWithPlayers = async (
    hostId: number,
    playerId: number,
    createdAt?: Date,
  ): Promise<{ game: Game; players: Player[] }> => {
    const game: Game = Game.create();
    if (createdAt) {
      game.createdAt = createdAt;
    }
    const createdGame: Game = await gameRepo.save(game);

    const host: Player = Player.create(hostId, createdGame.id);
    host.updateRole(GameRole.Host);
    const player: Player = Player.create(playerId, createdGame.id);
    const createdPlayers: Player[] = await Promise.all([
      playerRepo.save(host),
      playerRepo.save(player),
    ]);

    createdGame.startGame();
    const activeGame: Game = await gameRepo.save(createdGame);

    return { game: activeGame, players: createdPlayers };
  };

  const createFinishedGameWithPlayers = async (
    hostId: number,
    playerId: number,
    createdAt?: Date,
  ): Promise<{ game: Game; players: Player[] }> => {
    const game: Game = Game.create();
    if (createdAt) {
      game.createdAt = createdAt;
    }
    const createdGame: Game = await gameRepo.save(game);

    const host: Player = Player.create(hostId, createdGame.id);
    host.updateRole(GameRole.Host);
    const player: Player = Player.create(playerId, createdGame.id);
    const createdPlayers: Player[] = await Promise.all([
      playerRepo.save(host),
      playerRepo.save(player),
    ]);

    createdGame.startGame();
    createdGame.finishGame();
    const finishedGame: Game = await gameRepo.save(createdGame);

    return { game: finishedGame, players: createdPlayers };
  };

  const linkQuestionsToGame = async (
    gameId: number,
    questions: Question[],
  ): Promise<GameQuestion[]> => {
    const gameQuestions: GameQuestion[] = [];

    for (let i = 0; i < questions.length; i++) {
      const dto: GameQuestionCreateDto = {
        order: i + 1,
        gameId,
        questionId: questions[i].id,
      };

      const gameQuestion: GameQuestion = GameQuestion.create(dto);
      gameQuestions.push(await gameQuestionRepo.save(gameQuestion));
    }

    return gameQuestions;
  };

  const createTestAnswer = async (dto: AnswerCreateDto): Promise<Answer> => {
    const answer: Answer = Answer.create(dto);

    return await answerRepo.save(answer);
  };

  describe('Позитивные сценарии', () => {
    describe('Базовая пагинация', () => {
      it('должен вернуть все игры пользователя с корректной пагинацией (первая страница)', async () => {
        const user: User = await createTestUser();

        for (let i = 0; i < 5; i++) {
          const opponent: User = await createTestUser({
            login: `opponent_${i}`,
            email: `opponent_${i}@example.com`,
          });
          await createFinishedGameWithPlayers(user.id, opponent.id);
        }

        const queryParams: GetGamesQueryParams = new GetGamesQueryParams();
        queryParams.pageNumber = 1;
        queryParams.pageSize = 3;

        const result: PaginatedViewDto<GameViewDto> = await queryHandler.execute(
          new GetAllGamesForUserQuery(queryParams, user.id),
        );

        expect(result).toBeDefined();
        expect(result.page).toBe(1);
        expect(result.pageSize).toBe(3);
        expect(result.totalCount).toBe(5);
        expect(result.pagesCount).toBe(2);
        expect(result.items).toHaveLength(3);

        for (const game of result.items) {
          expect(game.id).toBeDefined();
          expect(game.status).toBe(GameStatus.Finished);

          const userIsFirstPlayer: boolean =
            game.firstPlayerProgress.player.id === user.id.toString();
          const userIsSecondPlayer: boolean =
            game.secondPlayerProgress?.player.id === user.id.toString();

          expect(userIsFirstPlayer || userIsSecondPlayer).toBeTruthy();
        }
      });

      it('должен корректно вернуть вторую страницу пагинации', async () => {
        const user: User = await createTestUser();

        for (let i = 0; i < 7; i++) {
          const opponent: User = await createTestUser({
            login: `opponent_${i}`,
            email: `opponent_${i}@example.com`,
          });
          await createFinishedGameWithPlayers(user.id, opponent.id);
        }

        const queryParams: GetGamesQueryParams = new GetGamesQueryParams();
        queryParams.pageNumber = 2;
        queryParams.pageSize = 5;

        const result: PaginatedViewDto<GameViewDto> = await queryHandler.execute(
          new GetAllGamesForUserQuery(queryParams, user.id),
        );

        expect(result.page).toBe(2);
        expect(result.pageSize).toBe(5);
        expect(result.totalCount).toBe(7);
        expect(result.pagesCount).toBe(2);
        expect(result.items).toHaveLength(2);
      });

      it('должен вернуть пустой массив items если pageNumber превышает количество страниц', async () => {
        const user: User = await createTestUser();

        for (let i = 0; i < 2; i++) {
          const opponent: User = await createTestUser({
            login: `opponent_${i}`,
            email: `opponent_${i}@example.com`,
          });
          await createFinishedGameWithPlayers(user.id, opponent.id);
        }

        const queryParams: GetGamesQueryParams = new GetGamesQueryParams();
        queryParams.pageNumber = 10;
        queryParams.pageSize = 5;

        const result: PaginatedViewDto<GameViewDto> = await queryHandler.execute(
          new GetAllGamesForUserQuery(queryParams, user.id),
        );

        expect(result.page).toBe(10);
        expect(result.pageSize).toBe(5);
        expect(result.totalCount).toBe(2);
        expect(result.pagesCount).toBe(1);
        expect(result.items).toEqual([]);
        expect(result.items).toHaveLength(0);
      });

      it('должен корректно работать когда pageSize больше общего числа игр', async () => {
        const user: User = await createTestUser();

        for (let i = 0; i < 3; i++) {
          const opponent: User = await createTestUser({
            login: `opponent_${i}`,
            email: `opponent_${i}@example.com`,
          });
          await createFinishedGameWithPlayers(user.id, opponent.id);
        }

        const queryParams: GetGamesQueryParams = new GetGamesQueryParams();
        queryParams.pageNumber = 1;
        queryParams.pageSize = 10;

        const result: PaginatedViewDto<GameViewDto> = await queryHandler.execute(
          new GetAllGamesForUserQuery(queryParams, user.id),
        );

        expect(result.pageSize).toBe(10);
        expect(result.totalCount).toBe(3);
        expect(result.items).toHaveLength(3);
        expect(result.pagesCount).toBe(1);
      });
    });

    describe('Сортировка игр', () => {
      it('должен корректно сортировать игры по дате создания (pairCreatedDate) в DESC порядке', async () => {
        const user: User = await createTestUser({
          login: 'host_user',
          email: 'host_user@example.com',
        });
        const opponent: User = await createTestUser({
          login: 'opponent',
          email: 'opponent@example.com',
        });

        const oldDate: Date = new Date('2020-01-01T10:00:00.000Z');
        const middleDate: Date = new Date('2023-06-15T15:30:00.000Z');
        const recentDate: Date = new Date('2025-11-20T08:00:00.000Z');

        await createFinishedGameWithPlayers(user.id, opponent.id, oldDate);
        await createFinishedGameWithPlayers(user.id, opponent.id, recentDate);
        await createFinishedGameWithPlayers(user.id, opponent.id, middleDate);

        const queryParams: GetGamesQueryParams = new GetGamesQueryParams();
        queryParams.sortBy = GamesSortBy.PairCreatedDate;
        queryParams.sortDirection = SortDirection.Descending;

        const result: PaginatedViewDto<GameViewDto> = await queryHandler.execute(
          new GetAllGamesForUserQuery(queryParams, user.id),
        );

        expect(result.items).toHaveLength(3);
        expect(result.items[0].pairCreatedDate).toBe(recentDate.toISOString());
        expect(result.items[1].pairCreatedDate).toBe(middleDate.toISOString());
        expect(result.items[2].pairCreatedDate).toBe(oldDate.toISOString());

        expect(result.items[0].pairCreatedDate >= result.items[1].pairCreatedDate).toBeTruthy();
        expect(result.items[1].pairCreatedDate >= result.items[2].pairCreatedDate).toBeTruthy();
      });

      it('должен корректно сортировать игры по дате создания (pairCreatedDate) в ASC порядке', async () => {
        const user: User = await createTestUser({
          login: 'host_user',
          email: 'host_user@example.com',
        });
        const opponent: User = await createTestUser({
          login: 'opponent',
          email: 'opponent@example.com',
        });

        const date1: Date = new Date('2020-01-01T10:00:00.000Z');
        const date2: Date = new Date('2023-06-15T15:30:00.000Z');
        const date3: Date = new Date('2025-11-20T08:00:00.000Z');

        await createFinishedGameWithPlayers(user.id, opponent.id, date2);
        await createFinishedGameWithPlayers(user.id, opponent.id, date1);
        await createFinishedGameWithPlayers(user.id, opponent.id, date3);

        const queryParams: GetGamesQueryParams = new GetGamesQueryParams();
        queryParams.sortBy = GamesSortBy.PairCreatedDate;
        queryParams.sortDirection = SortDirection.Ascending;

        const result: PaginatedViewDto<GameViewDto> = await queryHandler.execute(
          new GetAllGamesForUserQuery(queryParams, user.id),
        );

        expect(result.items).toHaveLength(3);
        expect(result.items[0].pairCreatedDate).toBe(date1.toISOString());
        expect(result.items[1].pairCreatedDate).toBe(date2.toISOString());
        expect(result.items[2].pairCreatedDate).toBe(date3.toISOString());

        expect(result.items[0].pairCreatedDate <= result.items[1].pairCreatedDate).toBeTruthy();
        expect(result.items[1].pairCreatedDate <= result.items[2].pairCreatedDate).toBeTruthy();
      });
    });

    describe('Различные статусы игр', () => {
      it('должен вернуть все игры пользователя со всеми статусами (Pending, Active, Finished)', async () => {
        const user: User = await createTestUser({
          login: 'host_user',
          email: 'host_user@example.com',
        });
        const opponent1: User = await createTestUser({
          login: 'opponent1',
          email: 'opponent1@example.com',
        });
        const opponent2: User = await createTestUser({
          login: 'opponent2',
          email: 'opponent2@example.com',
        });

        await createPendingGameWithOnePlayer(user.id);

        await createActiveGameWithPlayers(user.id, opponent1.id);

        await createFinishedGameWithPlayers(user.id, opponent2.id);

        const queryParams: GetGamesQueryParams = new GetGamesQueryParams();
        queryParams.pageNumber = 1;
        queryParams.pageSize = 10;

        const result: PaginatedViewDto<GameViewDto> = await queryHandler.execute(
          new GetAllGamesForUserQuery(queryParams, user.id),
        );

        expect(result.items).toHaveLength(3);
        const statuses: GameStatus[] = result.items.map((game) => game.status);

        expect(statuses).toContain(GameStatus.Pending);
        expect(statuses).toContain(GameStatus.Active);
        expect(statuses).toContain(GameStatus.Finished);
      });

      it('должен вернуть игру в статусе Pending с корректной структурой (без второго игрока, без вопросов)', async () => {
        const user: User = await createTestUser();
        const { game } = await createPendingGameWithOnePlayer(user.id);

        const queryParams: GetGamesQueryParams = new GetGamesQueryParams();

        const result: PaginatedViewDto<GameViewDto> = await queryHandler.execute(
          new GetAllGamesForUserQuery(queryParams, user.id),
        );

        expect(result.items).toHaveLength(1);
        const pendingGame: GameViewDto = result.items[0];

        expect(pendingGame.status).toBe(GameStatus.Pending);
        expect(pendingGame.id).toBe(game.id.toString());
        expect(pendingGame.startGameDate).toBeNull();
        expect(pendingGame.finishGameDate).toBeNull();

        expect(pendingGame.firstPlayerProgress).toBeDefined();
        expect(pendingGame.firstPlayerProgress.player.id).toBe(user.id.toString());
        expect(pendingGame.firstPlayerProgress.score).toBe(0);
        expect(pendingGame.firstPlayerProgress.answers).toEqual([]);

        expect(pendingGame.secondPlayerProgress).toBeNull();

        expect(pendingGame.questions).toBeNull();
      });

      it('должен вернуть игру в статусе Active с корректной структурой (оба игрока, вопросы присутствуют)', async () => {
        const user: User = await createTestUser({
          login: 'host_user',
          email: 'host_user@example.com',
        });
        const opponent: User = await createTestUser({
          login: 'opponent',
          email: 'opponent@example.com',
        });
        const { game } = await createActiveGameWithPlayers(user.id, opponent.id);
        const questions: Question[] =
          await createMultiplePublishedQuestions(REQUIRED_QUESTIONS_COUNT);
        await linkQuestionsToGame(game.id, questions);

        const queryParams: GetGamesQueryParams = new GetGamesQueryParams();

        const result: PaginatedViewDto<GameViewDto> = await queryHandler.execute(
          new GetAllGamesForUserQuery(queryParams, user.id),
        );

        expect(result.items).toHaveLength(1);
        const activeGame: GameViewDto = result.items[0];

        expect(activeGame.status).toBe(GameStatus.Active);
        expect(activeGame.startGameDate).toBeDefined();
        expect(activeGame.startGameDate).not.toBeNull();
        expect(activeGame.finishGameDate).toBeNull();

        expect(activeGame.firstPlayerProgress).toBeDefined();
        expect(activeGame.secondPlayerProgress).toBeDefined();
        expect(activeGame.secondPlayerProgress).not.toBeNull();

        expect(activeGame.questions).toHaveLength(REQUIRED_QUESTIONS_COUNT);
        for (let i = 0; i < REQUIRED_QUESTIONS_COUNT; i++) {
          expect(activeGame.questions![i].id).toBe(questions[i].publicId);
          expect(activeGame.questions![i].body).toBe(questions[i].body);
        }
      });

      it('должен вернуть игру в статусе Finished с корректной структурой (все даты заполнены)', async () => {
        const user: User = await createTestUser({
          login: 'host_user',
          email: 'host_user@example.com',
        });
        const opponent: User = await createTestUser({
          login: 'opponent',
          email: 'opponent@example.com',
        });
        const { game } = await createFinishedGameWithPlayers(user.id, opponent.id);
        const questions: Question[] =
          await createMultiplePublishedQuestions(REQUIRED_QUESTIONS_COUNT);
        await linkQuestionsToGame(game.id, questions);

        const queryParams: GetGamesQueryParams = new GetGamesQueryParams();

        const result: PaginatedViewDto<GameViewDto> = await queryHandler.execute(
          new GetAllGamesForUserQuery(queryParams, user.id),
        );

        expect(result.items).toHaveLength(1);
        const finishedGame: GameViewDto = result.items[0];

        expect(finishedGame.status).toBe(GameStatus.Finished);
        expect(finishedGame.startGameDate).toBeDefined();
        expect(finishedGame.startGameDate).not.toBeNull();
        expect(finishedGame.finishGameDate).toBeDefined();
        expect(finishedGame.finishGameDate).not.toBeNull();

        expect(finishedGame.firstPlayerProgress).toBeDefined();
        expect(finishedGame.secondPlayerProgress).toBeDefined();
        expect(finishedGame.secondPlayerProgress).not.toBeNull();

        expect(finishedGame.questions).toHaveLength(REQUIRED_QUESTIONS_COUNT);
      });
    });

    describe('Игры с ответами', () => {
      it('должен корректно вернуть игру с ответами обоих игроков', async () => {
        const user: User = await createTestUser({
          login: 'host_user',
          email: 'host_user@example.com',
        });
        const opponent: User = await createTestUser({
          login: 'opponent',
          email: 'opponent@example.com',
        });
        const { game, players } = await createFinishedGameWithPlayers(user.id, opponent.id);
        const questions: Question[] =
          await createMultiplePublishedQuestions(REQUIRED_QUESTIONS_COUNT);
        const gameQuestions: GameQuestion[] = await linkQuestionsToGame(game.id, questions);

        const answersPlayer1: Answer[] = [];
        const answersPlayer2: Answer[] = [];

        for (let i = 0; i < REQUIRED_QUESTIONS_COUNT; i++) {
          const answer1: Answer = await createTestAnswer({
            playerId: players[0].id,
            gameQuestionId: gameQuestions[i].id,
            gameId: game.id,
            answerBody: questions[i].correctAnswers[0],
            status: AnswerStatus.Correct,
          });

          const answer2: Answer = await createTestAnswer({
            playerId: players[1].id,
            gameQuestionId: gameQuestions[i].id,
            gameId: game.id,
            answerBody: 'Wrong answer',
            status: AnswerStatus.Incorrect,
          });

          answersPlayer1.push(answer1);
          answersPlayer2.push(answer2);
        }

        for (let i = 0; i < REQUIRED_QUESTIONS_COUNT; i++) {
          players[0].addScore();
        }
        await playerRepo.save(players[0]);

        const queryParams: GetGamesQueryParams = new GetGamesQueryParams();

        const result: PaginatedViewDto<GameViewDto> = await queryHandler.execute(
          new GetAllGamesForUserQuery(queryParams, user.id),
        );

        expect(result.items).toHaveLength(1);
        const gameWithAnswers: GameViewDto = result.items[0];

        expect(gameWithAnswers.firstPlayerProgress.score).toBe(REQUIRED_QUESTIONS_COUNT);
        expect(gameWithAnswers.firstPlayerProgress.answers).toHaveLength(REQUIRED_QUESTIONS_COUNT);

        for (let i = 0; i < answersPlayer1.length; i++) {
          expect(gameWithAnswers.firstPlayerProgress.answers[i].questionId).toBe(
            questions[i].publicId,
          );
          expect(gameWithAnswers.firstPlayerProgress.answers[i].answerStatus).toBe(
            AnswerStatus.Correct,
          );
          expect(gameWithAnswers.firstPlayerProgress.answers[i].addedAt).toBe(
            answersPlayer1[i].addedAt.toISOString(),
          );
        }

        expect(gameWithAnswers.secondPlayerProgress!.score).toBe(0);
        expect(gameWithAnswers.secondPlayerProgress!.answers).toHaveLength(
          REQUIRED_QUESTIONS_COUNT,
        );

        for (let i = 0; i < answersPlayer2.length; i++) {
          expect(gameWithAnswers.secondPlayerProgress!.answers[i].answerStatus).toBe(
            AnswerStatus.Incorrect,
          );
        }
      });
    });

    describe('Пользователь в разных ролях', () => {
      it('должен вернуть игры где пользователь является Host', async () => {
        const user: User = await createTestUser({
          login: 'host_user',
          email: 'host_user@example.com',
        });
        const opponent: User = await createTestUser({
          login: 'opponent',
          email: 'opponent@example.com',
        });

        await createActiveGameWithPlayers(user.id, opponent.id);

        const queryParams: GetGamesQueryParams = new GetGamesQueryParams();

        const result: PaginatedViewDto<GameViewDto> = await queryHandler.execute(
          new GetAllGamesForUserQuery(queryParams, user.id),
        );

        expect(result.items).toHaveLength(1);
        expect(result.items[0].firstPlayerProgress.player.id).toBe(user.id.toString());
        expect(result.items[0].secondPlayerProgress!.player.id).toBe(opponent.id.toString());
      });

      it('должен вернуть игры где пользователь является Player (второй игрок)', async () => {
        const user: User = await createTestUser({
          login: 'pl_user',
          email: 'pl_user@example.com',
        });
        const opponent: User = await createTestUser({
          login: 'opponent',
          email: 'opponent@example.com',
        });

        await createActiveGameWithPlayers(opponent.id, user.id);

        const queryParams: GetGamesQueryParams = new GetGamesQueryParams();

        const result: PaginatedViewDto<GameViewDto> = await queryHandler.execute(
          new GetAllGamesForUserQuery(queryParams, user.id),
        );

        expect(result.items).toHaveLength(1);
        expect(result.items[0].firstPlayerProgress.player.id).toBe(opponent.id.toString());
        expect(result.items[0].secondPlayerProgress!.player.id).toBe(user.id.toString());
      });

      it('должен вернуть игры где пользователь в разных ролях (Host и Player)', async () => {
        const user: User = await createTestUser({
          login: 'host_user',
          email: 'host_user@example.com',
        });
        const opponent1: User = await createTestUser({
          login: 'opponent1',
          email: 'opponent1@example.com',
        });
        const opponent2: User = await createTestUser({
          login: 'opponent2',
          email: 'opponent2@example.com',
        });

        await createFinishedGameWithPlayers(user.id, opponent1.id);

        await createFinishedGameWithPlayers(opponent2.id, user.id);

        const queryParams: GetGamesQueryParams = new GetGamesQueryParams();

        const result: PaginatedViewDto<GameViewDto> = await queryHandler.execute(
          new GetAllGamesForUserQuery(queryParams, user.id),
        );

        expect(result.items).toHaveLength(2);

        for (const game of result.items) {
          const userIsFirstPlayer: boolean =
            game.firstPlayerProgress.player.id === user.id.toString();
          const userIsSecondPlayer: boolean =
            game.secondPlayerProgress?.player.id === user.id.toString();

          expect(userIsFirstPlayer || userIsSecondPlayer).toBeTruthy();
        }
      });
    });
  });

  describe('Негативные сценарии', () => {
    describe('Пользователь без игр', () => {
      it('должен вернуть пустой список если у пользователя нет игр', async () => {
        const user: User = await createTestUser();

        const queryParams: GetGamesQueryParams = new GetGamesQueryParams();

        const result: PaginatedViewDto<GameViewDto> = await queryHandler.execute(
          new GetAllGamesForUserQuery(queryParams, user.id),
        );

        expect(result.page).toBe(1);
        expect(result.totalCount).toBe(0);
        expect(result.pagesCount).toBe(0);
        expect(result.items).toEqual([]);
        expect(result.items).toHaveLength(0);
      });

      it('должен вернуть пустой список для несуществующего userId', async () => {
        const nonExistentUserId = 99999;

        const user1: User = await createTestUser({
          login: 'user1',
          email: 'user1@example.com',
        });
        const user2: User = await createTestUser({
          login: 'user2',
          email: 'user2@example.com',
        });
        await createFinishedGameWithPlayers(user1.id, user2.id);

        const queryParams: GetGamesQueryParams = new GetGamesQueryParams();

        const result: PaginatedViewDto<GameViewDto> = await queryHandler.execute(
          new GetAllGamesForUserQuery(queryParams, nonExistentUserId),
        );

        expect(result.items).toEqual([]);
        expect(result.totalCount).toBe(0);
        expect(result.pagesCount).toBe(0);
      });
    });

    describe('Изоляция данных пользователей', () => {
      it('НЕ должен возвращать игры других пользователей', async () => {
        const user1: User = await createTestUser({
          login: 'user1',
          email: 'user1@example.com',
        });
        const user2: User = await createTestUser({
          login: 'user2',
          email: 'user2@example.com',
        });
        const opponent1: User = await createTestUser({
          login: 'opponent1',
          email: 'opponent1@example.com',
        });
        const opponent2: User = await createTestUser({
          login: 'opponent2',
          email: 'opponent2@example.com',
        });

        await createFinishedGameWithPlayers(user1.id, opponent1.id);

        await createFinishedGameWithPlayers(user2.id, opponent2.id);

        const queryParams: GetGamesQueryParams = new GetGamesQueryParams();

        const result: PaginatedViewDto<GameViewDto> = await queryHandler.execute(
          new GetAllGamesForUserQuery(queryParams, user1.id),
        );

        expect(result.items).toHaveLength(1);
        expect(result.totalCount).toBe(1);

        const game: GameViewDto = result.items[0];
        const userIsFirstPlayer: boolean =
          game.firstPlayerProgress.player.id === user1.id.toString();
        const userIsSecondPlayer: boolean =
          game.secondPlayerProgress?.player.id === user1.id.toString();

        expect(userIsFirstPlayer || userIsSecondPlayer).toBeTruthy();

        const user2IsFirstPlayer: boolean =
          game.firstPlayerProgress.player.id === user2.id.toString();
        const user2IsSecondPlayer: boolean =
          game.secondPlayerProgress?.player.id === user2.id.toString();

        expect(user2IsFirstPlayer || user2IsSecondPlayer).toBeFalsy();
      });
    });
  });
});
