// src/modules/quiz/public/application/queries/get-game.query-handler.int-spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, Repository } from 'typeorm';
import { TypeOrmModule } from '@nestjs/typeorm';

import { GetGameQuery, GetGameQueryHandler } from './get-game.query-handler';

import { DatabaseModule } from '../../../../database/database.module';
import { configModule } from '../../../../../dynamic-config.module';

import { Game, GameStatus } from '../../domain/entities/game.entity';
import { GameRole, Player } from '../../domain/entities/player.entity';
import { GameQuestion } from '../../domain/entities/game-question.entity';
import { Question } from '../../../admin/domain/entities/question.entity';
import { Answer, AnswerStatus } from '../../domain/entities/answer.entity';
import { User } from '../../../../user-accounts/users/domain/entities/user.entity';

import { GamesQueryRepository } from '../../infrastructure/query/games.query-repository';
import { PlayerValidationService } from '../../domain/services/player-validation.service';
import { PlayersRepository } from '../../infrastructure/players.repository';
import { QuestionInputDto } from '../../../admin/api/input-dto/question.input-dto';
import { GameQuestionCreateDto } from '../../domain/dto/game-question.create-dto';
import { getRelatedEntities } from '../../../../../core/utils/get-related-entities.utility';
import { GameViewDto } from '../../api/view-dto/game.view-dto';
import { UserInputDto } from '../../../../user-accounts/users/api/input-dto/user.input-dto';
import { CreateUserDto } from '../../../../user-accounts/users/dto/create-user.dto';
import { UsersFactory } from '../../../../user-accounts/users/application/factories/users.factory';
import { CryptoService } from '../../../../user-accounts/users/application/services/crypto.service';
import { DateService } from '../../../../user-accounts/users/application/services/date.service';
import { REQUIRED_QUESTIONS_COUNT } from '../../domain/constants/game.constants';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';

describe('GetGameQueryHandler (Integration)', () => {
  let module: TestingModule;
  let dataSource: DataSource;

  let queryHandler: GetGameQueryHandler;
  let usersFactory: UsersFactory;

  let gamesQueryRepository: GamesQueryRepository;
  let playerValidationService: PlayerValidationService;

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
        GetGameQueryHandler,

        UsersFactory,
        CryptoService,
        DateService,

        GamesQueryRepository,
        PlayerValidationService,
        PlayersRepository,
      ],
    }).compile();

    dataSource = module.get<DataSource>(DataSource);
    usersFactory = module.get<UsersFactory>(UsersFactory);
    queryHandler = module.get<GetGameQueryHandler>(GetGameQueryHandler);

    gamesQueryRepository = module.get<GamesQueryRepository>(GamesQueryRepository);
    playerValidationService = module.get<PlayerValidationService>(PlayerValidationService);

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

  const createActiveGameWithPlayers = async (hostId: number, playerId: number) => {
    const game: Game = Game.create();
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

  const createPendingGameWithOnePlayer = async (userId: number) => {
    const game: Game = Game.create();
    const createdGame: Game = await gameRepo.save(game);

    const player: Player = Player.create(userId, createdGame.id);
    player.updateRole(GameRole.Host);
    const createdPlayers: Player = await playerRepo.save(player);

    return { game: createdGame, player: createdPlayers };
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

  const createTestAnswer = async (
    playerId: number,
    gameQuestionId: number,
    gameId: number,
    answerBody: string,
    status: AnswerStatus,
  ): Promise<Answer> => {
    const answer: Answer = Answer.create({
      playerId,
      gameId,
      gameQuestionId,
      answerBody,
      status,
    });

    return await answerRepo.save(answer);
  };

  describe('Позитивные сценарии', () => {
    it('должен успешно вернуть данные игры для первого игрока (Host). Игра в статусе Pending', async () => {
      const { id: createdUserId, login }: User = await createTestUser();
      const { game } = await createPendingGameWithOnePlayer(createdUserId);
      await createMultiplePublishedQuestions(REQUIRED_QUESTIONS_COUNT);

      const gameViewDto: GameViewDto = await queryHandler.execute(
        new GetGameQuery(createdUserId, game.publicId),
      );

      expect(gameViewDto).toBeDefined();
      expect(gameViewDto).not.toBeNull();
      expect(gameViewDto.id).toBe(game.publicId);
      expect(gameViewDto.status).toBe(GameStatus.Pending);
      expect(gameViewDto.pairCreatedDate).toBe(game.createdAt.toISOString());
      expect(gameViewDto.startGameDate).toBeNull();
      expect(gameViewDto.finishGameDate).toBeNull();

      expect(gameViewDto.firstPlayerProgress).toBeDefined();
      expect(gameViewDto.firstPlayerProgress).not.toBeNull();
      expect(gameViewDto.firstPlayerProgress.player.id).toBe(createdUserId.toString());
      expect(gameViewDto.firstPlayerProgress.player.login).toBe(login);
      expect(gameViewDto.firstPlayerProgress.score).toBe(0);
      expect(gameViewDto.firstPlayerProgress.answers).toEqual([]);

      expect(gameViewDto.secondPlayerProgress).toBeNull();

      expect(gameViewDto.questions).toHaveLength(0);
      expect(gameViewDto.questions).toEqual([]);
    });

    it('должен успешно вернуть данные игры (БЕЗ ОТВЕТОВ) для первого игрока (Host). Игра в статусе Active', async () => {
      const firstUser: User = await createTestUser({
        login: 'firstUser',
        email: 'firstUser@example.com',
      });
      const secondUser: User = await createTestUser({
        login: 'secondUser',
        email: 'secondUser@example.com',
      });
      const { game } = await createActiveGameWithPlayers(firstUser.id, secondUser.id);
      const questions: Question[] =
        await createMultiplePublishedQuestions(REQUIRED_QUESTIONS_COUNT);
      await linkQuestionsToGame(game.id, questions);

      const gameViewDto: GameViewDto = await queryHandler.execute(
        new GetGameQuery(firstUser.id, game.publicId),
      );

      expect(gameViewDto).toBeDefined();
      expect(gameViewDto).not.toBeNull();
      expect(gameViewDto.id).toBe(game.publicId);
      expect(gameViewDto.status).toBe(GameStatus.Active);
      expect(gameViewDto.pairCreatedDate).toBe(game.createdAt.toISOString());
      expect(gameViewDto.startGameDate).toBe(game.startGameDate!.toISOString());
      expect(gameViewDto.finishGameDate).toBeNull();

      expect(gameViewDto.firstPlayerProgress).toBeDefined();
      expect(gameViewDto.firstPlayerProgress).not.toBeNull();
      expect(gameViewDto.firstPlayerProgress.player.id).toBe(firstUser.id.toString());
      expect(gameViewDto.firstPlayerProgress.player.login).toBe(firstUser.login);
      expect(gameViewDto.firstPlayerProgress.score).toBe(0);
      expect(gameViewDto.firstPlayerProgress.answers).toEqual([]);

      expect(gameViewDto.secondPlayerProgress).toBeDefined();
      expect(gameViewDto.secondPlayerProgress).not.toBeNull();
      expect(gameViewDto.secondPlayerProgress!.player.id).toBe(secondUser.id.toString());
      expect(gameViewDto.secondPlayerProgress!.player.login).toBe(secondUser.login);
      expect(gameViewDto.secondPlayerProgress!.score).toBe(0);
      expect(gameViewDto.secondPlayerProgress!.answers).toEqual([]);

      expect(gameViewDto.questions).toHaveLength(REQUIRED_QUESTIONS_COUNT);

      for (let i = 0; i < REQUIRED_QUESTIONS_COUNT; i++) {
        expect(questions[i].publicId).toBe(gameViewDto.questions[i].id);
        expect(questions[i].body).toBe(gameViewDto.questions[i].body);
      }
    });

    it('должен успешно вернуть данные игры (БЕЗ ОТВЕТОВ) для второго игрока (Player). Игра в статусе Active', async () => {
      const firstUser: User = await createTestUser({
        login: 'firstUser',
        email: 'firstUser@example.com',
      });
      const secondUser: User = await createTestUser({
        login: 'secondUser',
        email: 'secondUser@example.com',
      });
      const { game } = await createActiveGameWithPlayers(firstUser.id, secondUser.id);
      const questions: Question[] =
        await createMultiplePublishedQuestions(REQUIRED_QUESTIONS_COUNT);
      await linkQuestionsToGame(game.id, questions);

      const gameViewDto: GameViewDto = await queryHandler.execute(
        new GetGameQuery(secondUser.id, game.publicId),
      );

      expect(gameViewDto).toBeDefined();
      expect(gameViewDto).not.toBeNull();
      expect(gameViewDto.id).toBe(game.publicId);
      expect(gameViewDto.status).toBe(GameStatus.Active);
      expect(gameViewDto.pairCreatedDate).toBe(game.createdAt.toISOString());
      expect(gameViewDto.startGameDate).toBe(game.startGameDate!.toISOString());
      expect(gameViewDto.finishGameDate).toBeNull();

      expect(gameViewDto.firstPlayerProgress).toBeDefined();
      expect(gameViewDto.firstPlayerProgress).not.toBeNull();
      expect(gameViewDto.firstPlayerProgress.player.id).toBe(firstUser.id.toString());
      expect(gameViewDto.firstPlayerProgress.player.login).toBe(firstUser.login);
      expect(gameViewDto.firstPlayerProgress.score).toBe(0);
      expect(gameViewDto.firstPlayerProgress.answers).toEqual([]);

      expect(gameViewDto.secondPlayerProgress).toBeDefined();
      expect(gameViewDto.secondPlayerProgress).not.toBeNull();
      expect(gameViewDto.secondPlayerProgress!.player.id).toBe(secondUser.id.toString());
      expect(gameViewDto.secondPlayerProgress!.player.login).toBe(secondUser.login);
      expect(gameViewDto.secondPlayerProgress!.score).toBe(0);
      expect(gameViewDto.secondPlayerProgress!.answers).toEqual([]);

      expect(gameViewDto.questions).toHaveLength(REQUIRED_QUESTIONS_COUNT);

      for (let i = 0; i < REQUIRED_QUESTIONS_COUNT; i++) {
        expect(questions[i].publicId).toBe(gameViewDto.questions[i].id);
        expect(questions[i].body).toBe(gameViewDto.questions[i].body);
      }
    });

    it('должен успешно вернуть данные игры (БЕЗ ОТВЕТОВ) для первого игрока (Host). Игра в статусе Finished', async () => {
      const firstUser: User = await createTestUser({
        login: 'firstUser',
        email: 'firstUser@example.com',
      });
      const secondUser: User = await createTestUser({
        login: 'secondUser',
        email: 'secondUser@example.com',
      });
      const { game } = await createActiveGameWithPlayers(firstUser.id, secondUser.id);

      const questions: Question[] =
        await createMultiplePublishedQuestions(REQUIRED_QUESTIONS_COUNT);
      await linkQuestionsToGame(game.id, questions);

      game.finishGame();
      const finishedGame: Game = await gameRepo.save(game);

      const gameViewDto: GameViewDto = await queryHandler.execute(
        new GetGameQuery(firstUser.id, game.publicId),
      );

      expect(gameViewDto).toBeDefined();
      expect(gameViewDto).not.toBeNull();
      expect(gameViewDto.id).toBe(game.publicId);
      expect(gameViewDto.status).toBe(GameStatus.Finished);
      expect(gameViewDto.pairCreatedDate).toBe(game.createdAt.toISOString());
      expect(gameViewDto.startGameDate).toBe(game.startGameDate!.toISOString());
      expect(gameViewDto.finishGameDate).toBe(finishedGame.finishGameDate!.toISOString());

      expect(gameViewDto.firstPlayerProgress).toBeDefined();
      expect(gameViewDto.firstPlayerProgress).not.toBeNull();
      expect(gameViewDto.firstPlayerProgress.player.id).toBe(firstUser.id.toString());
      expect(gameViewDto.firstPlayerProgress.player.login).toBe(firstUser.login);
      expect(gameViewDto.firstPlayerProgress.score).toBe(0);
      expect(gameViewDto.firstPlayerProgress.answers).toEqual([]);

      expect(gameViewDto.secondPlayerProgress).toBeDefined();
      expect(gameViewDto.secondPlayerProgress).not.toBeNull();
      expect(gameViewDto.secondPlayerProgress!.player.id).toBe(secondUser.id.toString());
      expect(gameViewDto.secondPlayerProgress!.player.login).toBe(secondUser.login);
      expect(gameViewDto.secondPlayerProgress!.score).toBe(0);
      expect(gameViewDto.secondPlayerProgress!.answers).toEqual([]);

      expect(gameViewDto.questions).toHaveLength(REQUIRED_QUESTIONS_COUNT);

      for (let i = 0; i < REQUIRED_QUESTIONS_COUNT; i++) {
        expect(questions[i].publicId).toBe(gameViewDto.questions[i].id);
        expect(questions[i].body).toBe(gameViewDto.questions[i].body);
      }
    });

    it('должен успешно вернуть данные игры (БЕЗ ОТВЕТОВ) для второго игрока (Player). Игра в статусе Finished', async () => {
      const firstUser: User = await createTestUser({
        login: 'firstUser',
        email: 'firstUser@example.com',
      });
      const secondUser: User = await createTestUser({
        login: 'secondUser',
        email: 'secondUser@example.com',
      });
      const { game } = await createActiveGameWithPlayers(firstUser.id, secondUser.id);

      const questions: Question[] =
        await createMultiplePublishedQuestions(REQUIRED_QUESTIONS_COUNT);
      await linkQuestionsToGame(game.id, questions);

      game.finishGame();
      const finishedGame: Game = await gameRepo.save(game);

      const gameViewDto: GameViewDto = await queryHandler.execute(
        new GetGameQuery(secondUser.id, game.publicId),
      );

      expect(gameViewDto).toBeDefined();
      expect(gameViewDto).not.toBeNull();
      expect(gameViewDto.id).toBe(game.publicId);
      expect(gameViewDto.status).toBe(GameStatus.Finished);
      expect(gameViewDto.pairCreatedDate).toBe(game.createdAt.toISOString());
      expect(gameViewDto.startGameDate).toBe(game.startGameDate!.toISOString());
      expect(gameViewDto.finishGameDate).toBe(finishedGame.finishGameDate!.toISOString());

      expect(gameViewDto.firstPlayerProgress).toBeDefined();
      expect(gameViewDto.firstPlayerProgress).not.toBeNull();
      expect(gameViewDto.firstPlayerProgress.player.id).toBe(firstUser.id.toString());
      expect(gameViewDto.firstPlayerProgress.player.login).toBe(firstUser.login);
      expect(gameViewDto.firstPlayerProgress.score).toBe(0);
      expect(gameViewDto.firstPlayerProgress.answers).toEqual([]);

      expect(gameViewDto.secondPlayerProgress).toBeDefined();
      expect(gameViewDto.secondPlayerProgress).not.toBeNull();
      expect(gameViewDto.secondPlayerProgress!.player.id).toBe(secondUser.id.toString());
      expect(gameViewDto.secondPlayerProgress!.player.login).toBe(secondUser.login);
      expect(gameViewDto.secondPlayerProgress!.score).toBe(0);
      expect(gameViewDto.secondPlayerProgress!.answers).toEqual([]);

      expect(gameViewDto.questions).toHaveLength(REQUIRED_QUESTIONS_COUNT);

      for (let i = 0; i < REQUIRED_QUESTIONS_COUNT; i++) {
        expect(questions[i].publicId).toBe(gameViewDto.questions[i].id);
        expect(questions[i].body).toBe(gameViewDto.questions[i].body);
      }
    });

    it('должен успешно вернуть данные игры (С ОТВЕТАМИ) (только первого игрока). Игра в статусе Active', async () => {
      const firstUser: User = await createTestUser({
        login: 'firstUser',
        email: 'firstUser@example.com',
      });
      const secondUser: User = await createTestUser({
        login: 'secondUser',
        email: 'secondUser@example.com',
      });
      const { game, players } = await createActiveGameWithPlayers(firstUser.id, secondUser.id);
      const questions: Question[] =
        await createMultiplePublishedQuestions(REQUIRED_QUESTIONS_COUNT);
      const gameQuestions: GameQuestion[] = await linkQuestionsToGame(game.id, questions);
      const answers: Answer[] = [];

      for (let i = 0; i < REQUIRED_QUESTIONS_COUNT; i++) {
        const answer: Answer = await createTestAnswer(
          players[0].id,
          gameQuestions[i].id,
          game.id,
          questions[i].correctAnswers[0],
          AnswerStatus.Correct,
        );

        answers.push(answer);
      }

      players[0].addScore(6);
      await playerRepo.save(players[0]);

      const gameViewDto: GameViewDto = await queryHandler.execute(
        new GetGameQuery(secondUser.id, game.publicId),
      );

      expect(gameViewDto).toBeDefined();
      expect(gameViewDto).not.toBeNull();
      expect(gameViewDto.id).toBe(game.publicId);
      expect(gameViewDto.status).toBe(GameStatus.Active);
      expect(gameViewDto.pairCreatedDate).toBe(game.createdAt.toISOString());
      expect(gameViewDto.startGameDate).toBe(game.startGameDate!.toISOString());
      expect(gameViewDto.finishGameDate).toBeNull();

      expect(gameViewDto.firstPlayerProgress).toBeDefined();
      expect(gameViewDto.firstPlayerProgress).not.toBeNull();
      expect(gameViewDto.firstPlayerProgress.player.id).toBe(firstUser.id.toString());
      expect(gameViewDto.firstPlayerProgress.player.login).toBe(firstUser.login);
      expect(gameViewDto.firstPlayerProgress.score).toBe(6);

      for (let i = 0; i < answers.length; i++) {
        expect(gameViewDto.firstPlayerProgress.answers[i].questionId).toEqual(
          questions[i].publicId,
        );
        expect(gameViewDto.firstPlayerProgress.answers[i].answerStatus).toEqual(
          AnswerStatus.Correct,
        );
        expect(gameViewDto.firstPlayerProgress.answers[i].addedAt).toEqual(
          answers[i].addedAt.toISOString(),
        );
      }

      expect(gameViewDto.secondPlayerProgress).toBeDefined();
      expect(gameViewDto.secondPlayerProgress).not.toBeNull();
      expect(gameViewDto.secondPlayerProgress!.player.id).toBe(secondUser.id.toString());
      expect(gameViewDto.secondPlayerProgress!.player.login).toBe(secondUser.login);
      expect(gameViewDto.secondPlayerProgress!.score).toBe(0);
      expect(gameViewDto.secondPlayerProgress!.answers).toEqual([]);

      expect(gameViewDto.questions).toHaveLength(REQUIRED_QUESTIONS_COUNT);

      for (let i = 0; i < REQUIRED_QUESTIONS_COUNT; i++) {
        expect(questions[i].publicId).toBe(gameViewDto.questions[i].id);
        expect(questions[i].body).toBe(gameViewDto.questions[i].body);
      }
    });

    it('должен успешно вернуть данные игры (С ОТВЕТАМИ) (только второго игрока). Игра в статусе Active', async () => {
      const firstUser: User = await createTestUser({
        login: 'firstUser',
        email: 'firstUser@example.com',
      });
      const secondUser: User = await createTestUser({
        login: 'secondUser',
        email: 'secondUser@example.com',
      });
      const { game, players } = await createActiveGameWithPlayers(firstUser.id, secondUser.id);
      const questions: Question[] =
        await createMultiplePublishedQuestions(REQUIRED_QUESTIONS_COUNT);
      const gameQuestions: GameQuestion[] = await linkQuestionsToGame(game.id, questions);
      const answers: Answer[] = [];

      for (let i = 0; i < REQUIRED_QUESTIONS_COUNT; i++) {
        const answer: Answer = await createTestAnswer(
          players[1].id,
          gameQuestions[i].id,
          game.id,
          questions[i].correctAnswers[0],
          AnswerStatus.Correct,
        );

        answers.push(answer);
      }

      players[1].addScore(6);
      await playerRepo.save(players[1]);

      const gameViewDto: GameViewDto = await queryHandler.execute(
        new GetGameQuery(secondUser.id, game.publicId),
      );

      expect(gameViewDto).toBeDefined();
      expect(gameViewDto).not.toBeNull();
      expect(gameViewDto.id).toBe(game.publicId);
      expect(gameViewDto.status).toBe(GameStatus.Active);
      expect(gameViewDto.pairCreatedDate).toBe(game.createdAt.toISOString());
      expect(gameViewDto.startGameDate).toBe(game.startGameDate!.toISOString());
      expect(gameViewDto.finishGameDate).toBeNull();

      expect(gameViewDto.firstPlayerProgress).toBeDefined();
      expect(gameViewDto.firstPlayerProgress).not.toBeNull();
      expect(gameViewDto.firstPlayerProgress.player.id).toBe(firstUser.id.toString());
      expect(gameViewDto.firstPlayerProgress.player.login).toBe(firstUser.login);
      expect(gameViewDto.firstPlayerProgress.score).toBe(0);
      expect(gameViewDto.firstPlayerProgress.answers).toEqual([]);

      expect(gameViewDto.secondPlayerProgress).toBeDefined();
      expect(gameViewDto.secondPlayerProgress).not.toBeNull();
      expect(gameViewDto.secondPlayerProgress!.player.id).toBe(secondUser.id.toString());
      expect(gameViewDto.secondPlayerProgress!.player.login).toBe(secondUser.login);
      expect(gameViewDto.secondPlayerProgress!.score).toBe(6);

      for (let i = 0; i < answers.length; i++) {
        expect(gameViewDto.secondPlayerProgress!.answers[i].questionId).toEqual(
          questions[i].publicId,
        );
        expect(gameViewDto.secondPlayerProgress!.answers[i].answerStatus).toEqual(
          AnswerStatus.Correct,
        );
        expect(gameViewDto.secondPlayerProgress!.answers[i].addedAt).toEqual(
          answers[i].addedAt.toISOString(),
        );
      }

      expect(gameViewDto.questions).toHaveLength(REQUIRED_QUESTIONS_COUNT);

      for (let i = 0; i < REQUIRED_QUESTIONS_COUNT; i++) {
        expect(questions[i].publicId).toBe(gameViewDto.questions[i].id);
        expect(questions[i].body).toBe(gameViewDto.questions[i].body);
      }
    });

    it('должен успешно вернуть данные (БЕЗ ОТВЕТОВ) (двух игроков). Игра в статусе Active', async () => {
      const firstUser: User = await createTestUser({
        login: 'firstUser',
        email: 'firstUser@example.com',
      });
      const secondUser: User = await createTestUser({
        login: 'secondUser',
        email: 'secondUser@example.com',
      });
      const { game } = await createActiveGameWithPlayers(firstUser.id, secondUser.id);
      const questions: Question[] =
        await createMultiplePublishedQuestions(REQUIRED_QUESTIONS_COUNT);
      await linkQuestionsToGame(game.id, questions);

      const gameViewDto: GameViewDto = await queryHandler.execute(
        new GetGameQuery(firstUser.id, game.publicId),
      );

      expect(gameViewDto).toBeDefined();
      expect(gameViewDto).not.toBeNull();
      expect(gameViewDto.id).toBe(game.publicId);
      expect(gameViewDto.status).toBe(GameStatus.Active);
      expect(gameViewDto.pairCreatedDate).toBe(game.createdAt.toISOString());
      expect(gameViewDto.startGameDate).toBe(game.startGameDate!.toISOString());
      expect(gameViewDto.finishGameDate).toBeNull();

      expect(gameViewDto.firstPlayerProgress).toBeDefined();
      expect(gameViewDto.firstPlayerProgress).not.toBeNull();
      expect(gameViewDto.firstPlayerProgress.player.id).toBe(firstUser.id.toString());
      expect(gameViewDto.firstPlayerProgress.player.login).toBe(firstUser.login);
      expect(gameViewDto.firstPlayerProgress.score).toBe(0);
      expect(gameViewDto.firstPlayerProgress.answers).toEqual([]);

      expect(gameViewDto.secondPlayerProgress).toBeDefined();
      expect(gameViewDto.secondPlayerProgress).not.toBeNull();
      expect(gameViewDto.secondPlayerProgress!.player.id).toBe(secondUser.id.toString());
      expect(gameViewDto.secondPlayerProgress!.player.login).toBe(secondUser.login);
      expect(gameViewDto.secondPlayerProgress!.score).toBe(0);
      expect(gameViewDto.secondPlayerProgress!.answers).toEqual([]);

      expect(gameViewDto.questions).toHaveLength(REQUIRED_QUESTIONS_COUNT);

      for (let i = 0; i < REQUIRED_QUESTIONS_COUNT; i++) {
        expect(questions[i].publicId).toBe(gameViewDto.questions[i].id);
        expect(questions[i].body).toBe(gameViewDto.questions[i].body);
      }
    });

    it('должен успешно вернуть данные игры (С ОТВЕТАМИ) (двух игроков). Игра в статусе Active', async () => {
      const firstUser: User = await createTestUser({
        login: 'firstUser',
        email: 'firstUser@example.com',
      });
      const secondUser: User = await createTestUser({
        login: 'secondUser',
        email: 'secondUser@example.com',
      });
      const { game, players } = await createActiveGameWithPlayers(firstUser.id, secondUser.id);
      const questions: Question[] =
        await createMultiplePublishedQuestions(REQUIRED_QUESTIONS_COUNT);
      const gameQuestions: GameQuestion[] = await linkQuestionsToGame(game.id, questions);
      const answers_player1: Answer[] = [];
      const answers_player2: Answer[] = [];

      for (let i = 0; i < REQUIRED_QUESTIONS_COUNT - 2; i++) {
        const answer_player1: Answer = await createTestAnswer(
          players[0].id,
          gameQuestions[i].id,
          game.id,
          questions[i].correctAnswers[0],
          AnswerStatus.Correct,
        );

        const answer_player2: Answer = await createTestAnswer(
          players[1].id,
          gameQuestions[i].id,
          game.id,
          questions[i].correctAnswers[0],
          AnswerStatus.Correct,
        );

        answers_player1.push(answer_player1);
        answers_player2.push(answer_player2);
      }

      players[0].addScore(3);
      await playerRepo.save(players[0]);
      players[1].addScore(3);
      await playerRepo.save(players[1]);

      const gameViewDto: GameViewDto = await queryHandler.execute(
        new GetGameQuery(firstUser.id, game.publicId),
      );

      expect(gameViewDto).toBeDefined();
      expect(gameViewDto).not.toBeNull();
      expect(gameViewDto.id).toBe(game.publicId);
      expect(gameViewDto.status).toBe(GameStatus.Active);
      expect(gameViewDto.pairCreatedDate).toBe(game.createdAt.toISOString());
      expect(gameViewDto.startGameDate).toBe(game.startGameDate!.toISOString());
      expect(gameViewDto.finishGameDate).toBeNull();

      expect(gameViewDto.firstPlayerProgress).toBeDefined();
      expect(gameViewDto.firstPlayerProgress).not.toBeNull();
      expect(gameViewDto.firstPlayerProgress.player.id).toBe(firstUser.id.toString());
      expect(gameViewDto.firstPlayerProgress.player.login).toBe(firstUser.login);
      expect(gameViewDto.firstPlayerProgress.score).toBe(3);

      for (let i = 0; i < answers_player1.length; i++) {
        expect(gameViewDto.firstPlayerProgress.answers[i].questionId).toEqual(
          questions[i].publicId,
        );
        expect(gameViewDto.firstPlayerProgress.answers[i].answerStatus).toEqual(
          AnswerStatus.Correct,
        );
        expect(gameViewDto.firstPlayerProgress.answers[i].addedAt).toEqual(
          answers_player1[i].addedAt.toISOString(),
        );
      }

      expect(gameViewDto.secondPlayerProgress).toBeDefined();
      expect(gameViewDto.secondPlayerProgress).not.toBeNull();
      expect(gameViewDto.secondPlayerProgress!.player.id).toBe(secondUser.id.toString());
      expect(gameViewDto.secondPlayerProgress!.player.login).toBe(secondUser.login);
      expect(gameViewDto.secondPlayerProgress!.score).toBe(3);

      for (let i = 0; i < answers_player2.length; i++) {
        expect(gameViewDto.secondPlayerProgress!.answers[i].questionId).toEqual(
          questions[i].publicId,
        );
        expect(gameViewDto.secondPlayerProgress!.answers[i].answerStatus).toEqual(
          AnswerStatus.Correct,
        );
        expect(gameViewDto.secondPlayerProgress!.answers[i].addedAt).toEqual(
          answers_player2[i].addedAt.toISOString(),
        );
      }

      expect(gameViewDto.questions).toHaveLength(REQUIRED_QUESTIONS_COUNT);

      for (let i = 0; i < REQUIRED_QUESTIONS_COUNT; i++) {
        expect(questions[i].publicId).toBe(gameViewDto.questions[i].id);
        expect(questions[i].body).toBe(gameViewDto.questions[i].body);
      }
    });

    it('должен успешно вернуть данные игры (С ОТВЕТАМИ) (двух игроков). Игра в статусе Finished', async () => {
      const firstUser: User = await createTestUser({
        login: 'firstUser',
        email: 'firstUser@example.com',
      });
      const secondUser: User = await createTestUser({
        login: 'secondUser',
        email: 'secondUser@example.com',
      });
      const { game, players } = await createActiveGameWithPlayers(firstUser.id, secondUser.id);
      const questions: Question[] =
        await createMultiplePublishedQuestions(REQUIRED_QUESTIONS_COUNT);
      const gameQuestions: GameQuestion[] = await linkQuestionsToGame(game.id, questions);
      const answers_player1: Answer[] = [];
      const answers_player2: Answer[] = [];

      for (let i = 0; i < REQUIRED_QUESTIONS_COUNT; i++) {
        const answer_player1: Answer = await createTestAnswer(
          players[0].id,
          gameQuestions[i].id,
          game.id,
          questions[i].correctAnswers[0],
          AnswerStatus.Correct,
        );

        const answer_player2: Answer = await createTestAnswer(
          players[1].id,
          gameQuestions[i].id,
          game.id,
          questions[i].correctAnswers[0],
          AnswerStatus.Correct,
        );

        answers_player1.push(answer_player1);
        answers_player2.push(answer_player2);
      }

      players[0].addScore(6);
      await playerRepo.save(players[0]);
      players[1].addScore(5);
      await playerRepo.save(players[1]);

      game.finishGame();
      const finishedGame: Game = await gameRepo.save(game);

      const gameViewDto: GameViewDto = await queryHandler.execute(
        new GetGameQuery(firstUser.id, game.publicId),
      );

      expect(gameViewDto).toBeDefined();
      expect(gameViewDto).not.toBeNull();
      expect(gameViewDto.id).toBe(game.publicId);
      expect(gameViewDto.status).toBe(GameStatus.Finished);
      expect(gameViewDto.pairCreatedDate).toBe(game.createdAt.toISOString());
      expect(gameViewDto.startGameDate).toBe(game.startGameDate!.toISOString());
      expect(gameViewDto.finishGameDate).toBe(finishedGame.finishGameDate!.toISOString());

      expect(gameViewDto.firstPlayerProgress).toBeDefined();
      expect(gameViewDto.firstPlayerProgress).not.toBeNull();
      expect(gameViewDto.firstPlayerProgress.player.id).toBe(firstUser.id.toString());
      expect(gameViewDto.firstPlayerProgress.player.login).toBe(firstUser.login);
      expect(gameViewDto.firstPlayerProgress.score).toBe(6);

      for (let i = 0; i < answers_player1.length; i++) {
        expect(gameViewDto.firstPlayerProgress.answers[i].questionId).toEqual(
          questions[i].publicId,
        );
        expect(gameViewDto.firstPlayerProgress.answers[i].answerStatus).toEqual(
          AnswerStatus.Correct,
        );
        expect(gameViewDto.firstPlayerProgress.answers[i].addedAt).toEqual(
          answers_player1[i].addedAt.toISOString(),
        );
      }

      expect(gameViewDto.secondPlayerProgress).toBeDefined();
      expect(gameViewDto.secondPlayerProgress).not.toBeNull();
      expect(gameViewDto.secondPlayerProgress!.player.id).toBe(secondUser.id.toString());
      expect(gameViewDto.secondPlayerProgress!.player.login).toBe(secondUser.login);
      expect(gameViewDto.secondPlayerProgress!.score).toBe(5);

      for (let i = 0; i < answers_player2.length; i++) {
        expect(gameViewDto.secondPlayerProgress!.answers[i].questionId).toEqual(
          questions[i].publicId,
        );
        expect(gameViewDto.secondPlayerProgress!.answers[i].answerStatus).toEqual(
          AnswerStatus.Correct,
        );
        expect(gameViewDto.secondPlayerProgress!.answers[i].addedAt).toEqual(
          answers_player2[i].addedAt.toISOString(),
        );
      }

      expect(gameViewDto.questions).toHaveLength(REQUIRED_QUESTIONS_COUNT);

      for (let i = 0; i < REQUIRED_QUESTIONS_COUNT; i++) {
        expect(questions[i].publicId).toBe(gameViewDto.questions[i].id);
        expect(questions[i].body).toBe(gameViewDto.questions[i].body);
      }
    });

    describe('Негативные сценарии - игра не найдена', () => {
      it('должен выбросить DomainException NotFound для несуществующего publicId', async () => {
        const { id: createdUserId }: User = await createTestUser();
        await createPendingGameWithOnePlayer(createdUserId);
        await createMultiplePublishedQuestions(REQUIRED_QUESTIONS_COUNT);
        const nonExistentGameId = '550e8400-e29b-41d4-a716-446655440000';

        try {
          await queryHandler.execute(new GetGameQuery(createdUserId, nonExistentGameId));
          fail('Ожидали DomainException');
        } catch (error) {
          expect(error).toBeInstanceOf(DomainException);
          expect((error as DomainException).code).toBe(DomainExceptionCode.NotFound);
          expect((error as DomainException).message).toBe(
            `The post with ID (${nonExistentGameId}) does not exist`,
          );
        }
      });
    });

    describe('Негативные сценарии - пользователь не участвует в игре', () => {
      it('должен выбросить DomainException Forbidden если пользователь не является участником игры', async () => {
        const { id: firstUserId }: User = await createTestUser({
          login: 'firstUser',
          email: 'firstUser@example.com',
        });
        const { id: secondUserId }: User = await createTestUser({
          login: 'secondUser',
          email: 'secondUser@example.com',
        });
        const { id: thirdUserId }: User = await createTestUser({
          login: 'thirdUser',
          email: 'thirdUser@example.com',
        });
        const { id: userIdUnderTest }: User = await createTestUser({
          login: 'fourthUser',
          email: 'fourthUser@example.com',
        });

        const { game: activeGame } = await createActiveGameWithPlayers(firstUserId, secondUserId);
        const { game: pendingGame } = await createPendingGameWithOnePlayer(thirdUserId);

        const questionsForActiveGame: Question[] = await createMultiplePublishedQuestions(5);
        const questionsForPendingGame: Question[] = await createMultiplePublishedQuestions(5);
        await linkQuestionsToGame(activeGame.id, questionsForActiveGame);
        await linkQuestionsToGame(pendingGame.id, questionsForPendingGame);

        try {
          await queryHandler.execute(new GetGameQuery(userIdUnderTest, activeGame.publicId));
          fail('Ожидали DomainException');
        } catch (error) {
          expect(error).toBeInstanceOf(DomainException);
          expect((error as DomainException).code).toBe(DomainExceptionCode.Forbidden);
          expect((error as DomainException).message).toBe(
            `User with id ${userIdUnderTest} is not a participant of game with id ${activeGame.publicId}`,
          );
        }

        try {
          await queryHandler.execute(new GetGameQuery(userIdUnderTest, pendingGame.publicId));
          fail('Ожидали DomainException');
        } catch (error) {
          expect(error).toBeInstanceOf(DomainException);
          expect((error as DomainException).code).toBe(DomainExceptionCode.Forbidden);
          expect((error as DomainException).message).toBe(
            `User with id ${userIdUnderTest} is not a participant of game with id ${pendingGame.publicId}`,
          );
        }
      });
    });
  });
});
