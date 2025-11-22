// src/modules/quiz/public/application/usecases/connect-to-game.usecase.int-spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { ConnectToGameCommand, ConnectToGameUseCase } from './connect-to-game.usecase';
import { DataSource, Repository } from 'typeorm';
import { DatabaseModule } from '../../../../database/database.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GamesRepository } from '../../infrastructure/games.repository';
import { PlayersRepository } from '../../infrastructure/players.repository';
import { QuestionsRepository } from '../../../admin/infrastructure/questions-repository';
import { Game, GameStatus } from '../../domain/entities/game.entity';
import { GameRole, Player } from '../../domain/entities/player.entity';
import { Question } from '../../../admin/domain/entities/question.entity';
import { GameQuestion } from '../../domain/entities/game-question.entity';
import { configModule } from '../../../../../dynamic-config.module';
import { QuestionInputDto } from '../../../admin/api/input-dto/question.input-dto';
import { getRelatedEntities } from '../../../../../core/utils/get-related-entities.utility';
import { User } from '../../../../user-accounts/users/domain/entities/user.entity';
import { CreateUserDto } from '../../../../user-accounts/users/dto/create-user.dto';
import { UsersFactory } from '../../../../user-accounts/users/application/factories/users.factory';
import { CryptoService } from '../../../../user-accounts/users/application/services/crypto.service';
import { DateService } from '../../../../user-accounts/users/application/services/date.service';
import { UserInputDto } from '../../../../user-accounts/users/api/input-dto/user.input-dto';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';
import { GameMatchingService } from '../../domain/services/game-matching.service';
import { GameQuestionsService } from '../../domain/services/game-questions.service';
import { GameStateService } from '../../domain/services/game-state.service';
import { PlayerValidationService } from '../../domain/services/player-validation.service';

describe('ConnectToGameUseCase (Integration)', () => {
  let module: TestingModule;
  let dataSource: DataSource;

  let useCase: ConnectToGameUseCase;
  let usersFactory: UsersFactory;

  let gamesRepository: GamesRepository;
  let playersRepository: PlayersRepository;
  let questionsRepository: QuestionsRepository;

  let userRepo: Repository<User>;
  let gameRepo: Repository<Game>;
  let playerRepo: Repository<Player>;
  let questionRepo: Repository<Question>;
  let gameQuestionRepo: Repository<GameQuestion>;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [configModule, DatabaseModule, TypeOrmModule.forFeature(getRelatedEntities(Game))],
      providers: [
        ConnectToGameUseCase,

        GamesRepository,
        PlayersRepository,
        QuestionsRepository,

        UsersFactory,
        CryptoService,
        DateService,

        GameMatchingService,
        GameQuestionsService,
        GameStateService,
        PlayerValidationService,
      ],
    }).compile();

    dataSource = module.get<DataSource>(DataSource);
    usersFactory = module.get<UsersFactory>(UsersFactory);
    useCase = module.get<ConnectToGameUseCase>(ConnectToGameUseCase);

    gamesRepository = module.get<GamesRepository>(GamesRepository);
    playersRepository = module.get<PlayersRepository>(PlayersRepository);
    questionsRepository = module.get<QuestionsRepository>(QuestionsRepository);

    gameRepo = dataSource.getRepository<Game>(Game);
    playerRepo = dataSource.getRepository<Player>(Player);
    questionRepo = dataSource.getRepository<Question>(Question);
    gameQuestionRepo = dataSource.getRepository<GameQuestion>(GameQuestion);
    userRepo = dataSource.getRepository<User>(User);
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE TABLE games RESTART IDENTITY CASCADE');
    await dataSource.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
    await dataSource.query('TRUNCATE TABLE questions RESTART IDENTITY CASCADE');
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

  const createTestQuestion = async (
    questionData?: Partial<QuestionInputDto>,
  ): Promise<Question> => {
    const defaultData: QuestionInputDto = {
      body: 'What is the capital of France?',
      correctAnswers: ['Paris'],
      ...questionData,
    };

    const question: Question = Question.create(defaultData);
    return await questionRepo.save(question);
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

  const createTestGameWithPlayer = async (
    userId: number,
  ): Promise<{ game: Game; player: Player }> => {
    const game: Game = Game.create();
    const savedGame: Game = await gameRepo.save(game);

    const player: Player = Player.create(userId, savedGame.id);
    player.updateRole(GameRole.Host);
    const savedPlayer: Player = await playerRepo.save(player);

    return { game: savedGame, player: savedPlayer };
  };

  describe('Позитивные сценарии', () => {
    it('должен успешно создать новую игру для первого пользователя с ролью Host', async () => {
      const { id: userId }: User = await createTestUser();
      await createMultiplePublishedQuestions(5);

      const gameId: number = await useCase.execute(new ConnectToGameCommand(userId));

      expect(gameId).toBeDefined();
      expect(gameId).not.toBeNull();
      expect(typeof gameId).toBe('number');
      expect(gameId).toBeGreaterThan(0);

      const createdGame: Game | null = await gameRepo.findOne({
        where: { id: gameId },
      });

      expect(createdGame).toBeDefined();
      expect(createdGame).not.toBeNull();
      expect(createdGame!.status).toBe(GameStatus.Pending);
      expect(createdGame!.createdAt).toBeInstanceOf(Date);
      expect(createdGame!.startGameDate).toBeNull();
      expect(createdGame!.finishGameDate).toBeNull();

      const player: Player | null = await playerRepo.findOne({
        where: { userId, gameId },
      });

      expect(player).toBeDefined();
      expect(player).not.toBeNull();
      expect(player!.role).toBe(GameRole.Host);
      expect(player!.userId).toBe(userId);
      expect(player!.gameId).toBe(gameId);
      expect(player!.score).toBe(0);

      const gameQuestionsCount: number = await gameQuestionRepo.count({
        where: { gameId },
      });
      expect(gameQuestionsCount).toBe(0);
    });

    it('должен подключить второго игрока к существующей игре и запустить её с вопросами', async () => {
      const { id: firstUserId }: User = await createTestUser({
        login: 'firstUser',
        email: 'firstUser@example.com',
      });
      const { id: secondUserId }: User = await createTestUser({
        login: 'secondUser',
        email: 'secondUser@example.com',
      });
      const questions: Question[] = await createMultiplePublishedQuestions(5);

      const gameId: number = await useCase.execute(new ConnectToGameCommand(firstUserId));
      const returnedGameId: number = await useCase.execute(new ConnectToGameCommand(secondUserId));

      expect(returnedGameId).toBe(gameId);

      const startedGame: Game | null = await gameRepo.findOne({
        where: { id: gameId },
      });

      expect(startedGame).toBeDefined();
      expect(startedGame).not.toBeNull();
      expect(startedGame!.status).toBe(GameStatus.Active);
      expect(startedGame!.startGameDate).toBeInstanceOf(Date);
      expect(startedGame!.finishGameDate).toBeNull();

      const players: Player[] = await playerRepo.find({
        where: { gameId },
        order: { userId: 'ASC' },
      });

      expect(players).toHaveLength(2);
      expect(players[0].userId).toBe(firstUserId);
      expect(players[0].role).toBe(GameRole.Host);
      expect(players[0].score).toBe(0);
      expect(players[1].userId).toBe(secondUserId);
      expect(players[1].role).toBe(GameRole.Player);
      expect(players[1].score).toBe(0);

      const gameQuestions: GameQuestion[] = await gameQuestionRepo.find({
        where: { gameId },
        order: { order: 'ASC' },
      });

      expect(gameQuestions).toHaveLength(5);

      gameQuestions.forEach((gq, index) => {
        expect(gq.order).toBe(index + 1);
        expect(gq.gameId).toBe(gameId);
        expect(gq.questionId).toBeDefined();
        expect(gq.questionId).not.toBeNull();
      });

      const questionIds: number[] = gameQuestions.map((gq) => gq.questionId);
      const uniqueQuestionIds = new Set(questionIds);
      expect(uniqueQuestionIds.size).toBe(5);

      const availableQuestionIds: number[] = questions.map((q) => q.id);
      questionIds.forEach((id) => {
        expect(availableQuestionIds).toContain(id);
      });
    });

    it('должен создать вторую игру если третий игрок пытается подключиться', async () => {
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
      await createMultiplePublishedQuestions(10);

      const firstGameId: number = await useCase.execute(new ConnectToGameCommand(firstUserId));
      await useCase.execute(new ConnectToGameCommand(secondUserId));

      const secondGameId: number = await useCase.execute(new ConnectToGameCommand(thirdUserId));

      expect(secondGameId).not.toBe(firstGameId);
      expect(secondGameId).toBeGreaterThan(firstGameId);

      const firstGame: Game | null = await gameRepo.findOne({
        where: { id: firstGameId },
      });
      const secondGame: Game | null = await gameRepo.findOne({
        where: { id: secondGameId },
      });

      expect(firstGame!.status).toBe(GameStatus.Active);
      expect(secondGame!.status).toBe(GameStatus.Pending);

      const thirdPlayer: Player | null = await playerRepo.findOne({
        where: { userId: thirdUserId, gameId: secondGameId },
      });

      expect(thirdPlayer).toBeDefined();
      expect(thirdPlayer).not.toBeNull();
      expect(thirdPlayer!.role).toBe(GameRole.Host);

      const totalGames: number = await gameRepo.count();
      const totalPlayers: number = await playerRepo.count();

      expect(totalGames).toBe(2);
      expect(totalPlayers).toBe(3);

      const firstGameQuestions: number = await gameQuestionRepo.count({
        where: { gameId: firstGameId },
      });
      const secondGameQuestions: number = await gameQuestionRepo.count({
        where: { gameId: secondGameId },
      });

      expect(firstGameQuestions).toBe(5);
      expect(secondGameQuestions).toBe(0);
    });

    it('должен использовать точно 5 вопросов даже если доступно больше', async () => {
      const { id: firstUserId }: User = await createTestUser({
        login: 'firstUser',
        email: 'firstUser@example.com',
      });
      const { id: secondUserId }: User = await createTestUser({
        login: 'secondUser',
        email: 'secondUser@example.com',
      });
      await createMultiplePublishedQuestions(50);

      const gameId: number = await useCase.execute(new ConnectToGameCommand(firstUserId));
      await useCase.execute(new ConnectToGameCommand(secondUserId));

      const gameQuestionsCount: number = await gameQuestionRepo.count({
        where: { gameId },
      });

      expect(gameQuestionsCount).toBe(5);
    });
  });

  describe('Негативные сценарии - пользователь уже участвует в игре', () => {
    it('должен выбросить DomainException Forbidden если пользователь уже является хостом ожидающей игры', async () => {
      const { id: userId }: User = await createTestUser();
      await createMultiplePublishedQuestions(5);

      await useCase.execute(new ConnectToGameCommand(userId));

      try {
        await useCase.execute(new ConnectToGameCommand(userId));
        fail('Ожидали DomainException');
      } catch (error) {
        expect(error).toBeInstanceOf(DomainException);
        expect((error as DomainException).code).toBe(DomainExceptionCode.Forbidden);
        expect((error as DomainException).message).toBe(
          `User with id ${userId} is already participating in active pair`,
        );
      }

      const gameCount: number = await gameRepo.count();
      const playerCount: number = await playerRepo.count();

      expect(gameCount).toBe(1);
      expect(playerCount).toBe(1);
    });

    it('должен выбросить DomainException Forbidden если пользователь уже участвует в активной игре', async () => {
      const { id: firstUserId }: User = await createTestUser({
        login: 'firstUser',
        email: 'firstUser@example.com',
      });
      const { id: secondUserId }: User = await createTestUser({
        login: 'secondUser',
        email: 'secondUser@example.com',
      });
      await createMultiplePublishedQuestions(5);

      const gameId: number = await useCase.execute(new ConnectToGameCommand(firstUserId));
      await useCase.execute(new ConnectToGameCommand(secondUserId));

      const game: Game | null = await gameRepo.findOne({ where: { id: gameId } });
      expect(game!.status).toBe(GameStatus.Active);

      try {
        await useCase.execute(new ConnectToGameCommand(firstUserId));
        fail('Ожидали DomainException');
      } catch (error) {
        expect(error).toBeInstanceOf(DomainException);
        expect((error as DomainException).code).toBe(DomainExceptionCode.Forbidden);
        expect((error as DomainException).message).toBe(
          `User with id ${firstUserId} is already participating in active pair`,
        );
      }

      try {
        await useCase.execute(new ConnectToGameCommand(secondUserId));
        fail('Ожидали DomainException');
      } catch (error) {
        expect(error).toBeInstanceOf(DomainException);
        expect((error as DomainException).code).toBe(DomainExceptionCode.Forbidden);
        expect((error as DomainException).message).toBe(
          `User with id ${secondUserId} is already participating in active pair`,
        );
      }
    });
  });

  describe('Негативные сценарии - недостаток вопросов', () => {
    it('должен выбросить DomainException InternalServerError если нет опубликованных вопросов', async () => {
      const { id: firstUserId }: User = await createTestUser({
        login: 'firstUser',
        email: 'firstUser@example.com',
      });
      const { id: secondUserId }: User = await createTestUser({
        login: 'secondUser',
        email: 'secondUser@example.com',
      });
      await createTestQuestion(); // Неопубликованный

      const gameId: number = await useCase.execute(new ConnectToGameCommand(firstUserId));

      try {
        await useCase.execute(new ConnectToGameCommand(secondUserId));
        fail('Ожидали DomainException');
      } catch (error) {
        expect(error).toBeInstanceOf(DomainException);
        expect((error as DomainException).code).toBe(DomainExceptionCode.InternalServerError);
        expect((error as DomainException).message).toBe(
          'Insufficient published questions for game creation. Required: 5, available: 0',
        );
      }

      const game: Game | null = await gameRepo.findOne({ where: { id: gameId } });
      expect(game!.status).toBe(GameStatus.Pending);

      const playerCount: number = await playerRepo.count();
      expect(playerCount).toBe(1);

      const gameQuestionsCount: number = await gameQuestionRepo.count({ where: { gameId } });
      expect(gameQuestionsCount).toBe(0);
    });

    it('должен выбросить DomainException InternalServerError если недостаточно опубликованных вопросов', async () => {
      const { id: firstUserId }: User = await createTestUser({
        login: 'firstUser',
        email: 'firstUser@example.com',
      });
      const { id: secondUserId }: User = await createTestUser({
        login: 'secondUser',
        email: 'secondUser@example.com',
      });
      await createMultiplePublishedQuestions(3);

      const gameId: number = await useCase.execute(new ConnectToGameCommand(firstUserId));

      try {
        await useCase.execute(new ConnectToGameCommand(secondUserId));
        fail('Ожидали DomainException');
      } catch (error) {
        expect(error).toBeInstanceOf(DomainException);
        expect((error as DomainException).code).toBe(DomainExceptionCode.InternalServerError);
        expect((error as DomainException).message).toBe(
          'Insufficient published questions for game creation. Required: 5, available: 3',
        );
      }

      const game: Game | null = await gameRepo.findOne({ where: { id: gameId } });
      expect(game!.status).toBe(GameStatus.Pending);

      const playerCount: number = await playerRepo.count();
      expect(playerCount).toBe(1);

      const gameQuestionsCount: number = await gameQuestionRepo.count({ where: { gameId } });
      expect(gameQuestionsCount).toBe(0);
    });

    it('должен учитывать только опубликованные вопросы при проверке количества', async () => {
      const { id: firstUserId }: User = await createTestUser({
        login: 'firstUser',
        email: 'firstUser@example.com',
      });
      const { id: secondUserId }: User = await createTestUser({
        login: 'secondUser',
        email: 'secondUser@example.com',
      });
      await createTestQuestion(); // Неопубликованный
      await createTestQuestion(); // Неопубликованный
      await createTestQuestion(); // Неопубликованный
      await createMultiplePublishedQuestions(2); // 2 опубликованных

      const gameId: number = await useCase.execute(new ConnectToGameCommand(firstUserId));

      try {
        await useCase.execute(new ConnectToGameCommand(secondUserId));
        fail('Ожидали DomainException');
      } catch (error) {
        expect(error).toBeInstanceOf(DomainException);
        expect((error as DomainException).message).toBe(
          'Insufficient published questions for game creation. Required: 5, available: 2',
        );
      }

      const game: Game | null = await gameRepo.findOne({ where: { id: gameId } });
      expect(game!.status).toBe(GameStatus.Pending);

      const playerCount: number = await playerRepo.count();
      expect(playerCount).toBe(1);

      const gameQuestionsCount: number = await gameQuestionRepo.count({ where: { gameId } });
      expect(gameQuestionsCount).toBe(0);
    });
  });

  describe('Проверка взаимодействия с репозиториями', () => {
    it('должен корректно вызвать методы репозиториев при создании новой игры', async () => {
      const { id: userId }: User = await createTestUser();
      await createMultiplePublishedQuestions(5);

      const getPlayerSpy = jest.spyOn(playersRepository, 'getPlayerByUserIdInPendingOrActiveGame');
      const getGameInPendingSpy = jest.spyOn(gamesRepository, 'getGameInPending');
      const saveGameSpy = jest.spyOn(gamesRepository, 'save');
      const savePlayerSpy = jest.spyOn(playersRepository, 'save');

      await useCase.execute(new ConnectToGameCommand(userId));

      expect(getPlayerSpy).toHaveBeenCalledWith(userId);
      expect(getGameInPendingSpy).toHaveBeenCalledTimes(1);
      expect(saveGameSpy).toHaveBeenCalledTimes(1);
      expect(savePlayerSpy).toHaveBeenCalledTimes(1);

      const savedPlayer = savePlayerSpy.mock.calls[0][0];
      expect(savedPlayer.userId).toBe(userId);
      expect(savedPlayer.role).toBe(GameRole.Host);

      getPlayerSpy.mockRestore();
      getGameInPendingSpy.mockRestore();
      saveGameSpy.mockRestore();
      savePlayerSpy.mockRestore();
    });

    it('должен корректно вызвать методы репозиториев при подключении к существующей игре', async () => {
      const { id: firstUserId }: User = await createTestUser({
        login: 'firstUser',
        email: 'firstUser@example.com',
      });
      const { id: secondUserId }: User = await createTestUser({
        login: 'secondUser',
        email: 'secondUser@example.com',
      });
      await createMultiplePublishedQuestions(5);

      await useCase.execute(new ConnectToGameCommand(firstUserId));

      const getPlayerSpy = jest.spyOn(playersRepository, 'getPlayerByUserIdInPendingOrActiveGame');
      const getGameInPendingSpy = jest.spyOn(gamesRepository, 'getGameInPending');
      const savePlayerSpy = jest.spyOn(playersRepository, 'save');
      const getRandomQuestionsSpy = jest.spyOn(questionsRepository, 'getRandomPublishedQuestions');
      const saveGameQuestionSpy = jest.spyOn(gamesRepository, 'saveGameQuestion');
      const saveGameSpy = jest.spyOn(gamesRepository, 'save');

      await useCase.execute(new ConnectToGameCommand(secondUserId));

      expect(getPlayerSpy).toHaveBeenCalledWith(secondUserId);
      expect(getGameInPendingSpy).toHaveBeenCalledTimes(1);
      expect(savePlayerSpy).toHaveBeenCalledTimes(1);
      expect(getRandomQuestionsSpy).toHaveBeenCalledWith(5);
      expect(saveGameQuestionSpy).toHaveBeenCalledTimes(5);
      expect(saveGameSpy).toHaveBeenCalledTimes(1);

      const savedPlayer = savePlayerSpy.mock.calls[0][0];
      expect(savedPlayer.userId).toBe(secondUserId);
      expect(savedPlayer.role).toBe(GameRole.Player);

      getPlayerSpy.mockRestore();
      getGameInPendingSpy.mockRestore();
      savePlayerSpy.mockRestore();
      getRandomQuestionsSpy.mockRestore();
      saveGameQuestionSpy.mockRestore();
      saveGameSpy.mockRestore();
    });

    it('должен правильно вызвать startGame на сущности игры', async () => {
      const { id: firstUserId }: User = await createTestUser({
        login: 'firstUser',
        email: 'firstUser@example.com',
      });
      const { id: secondUserId }: User = await createTestUser({
        login: 'secondUser',
        email: 'secondUser@example.com',
      });
      await createMultiplePublishedQuestions(5);

      const gameId: number = await useCase.execute(new ConnectToGameCommand(firstUserId));

      const gameBeforeStart: Game | null = await gameRepo.findOne({ where: { id: gameId } });
      expect(gameBeforeStart!.status).toBe(GameStatus.Pending);
      expect(gameBeforeStart!.startGameDate).toBeNull();

      await useCase.execute(new ConnectToGameCommand(secondUserId));

      const gameAfterStart: Game | null = await gameRepo.findOne({ where: { id: gameId } });
      expect(gameAfterStart!.status).toBe(GameStatus.Active);
      expect(gameAfterStart!.startGameDate).toBeInstanceOf(Date);
    });
  });
});
