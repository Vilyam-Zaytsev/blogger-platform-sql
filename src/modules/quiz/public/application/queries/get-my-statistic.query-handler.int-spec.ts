import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, Repository } from 'typeorm';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  GetMyStatisticQuery,
  GetMyStatisticQueryHandler,
} from './get-satistic-for-user.query-handler';

import { DatabaseModule } from '../../../../database/database.module';
import { configModule } from '../../../../../dynamic-config.module';

import { Game } from '../../domain/entities/game.entity';
import { GameRole, Player } from '../../domain/entities/player.entity';
import { GameQuestion } from '../../domain/entities/game-question.entity';
import { Question } from '../../../admin/domain/entities/question.entity';
import { Answer } from '../../domain/entities/answer.entity';
import { User } from '../../../../user-accounts/users/domain/entities/user.entity';

import { GamesQueryRepository } from '../../infrastructure/query/games.query-repository';
import { PlayersRepository } from '../../infrastructure/players.repository';
import { QuestionInputDto } from '../../../admin/api/input-dto/question.input-dto';
import { getRelatedEntities } from '../../../../../core/utils/get-related-entities.utility';
import { UserInputDto } from '../../../../user-accounts/users/api/input-dto/user.input-dto';
import { CreateUserDto } from '../../../../user-accounts/users/dto/create-user.dto';
import { UsersFactory } from '../../../../user-accounts/users/application/factories/users.factory';
import { CryptoService } from '../../../../user-accounts/users/application/services/crypto.service';
import { DateService } from '../../../../user-accounts/users/application/services/date.service';
import { StatisticViewDto } from '../../api/view-dto/statistic.view-dto';
import { TransactionHelper } from '../../../../database/trasaction.helper';

describe('GetMyStatisticQueryHandler (Integration)', () => {
  let module: TestingModule;
  let dataSource: DataSource;

  let queryHandler: GetMyStatisticQueryHandler;
  let usersFactory: UsersFactory;

  let gamesQueryRepository: GamesQueryRepository;

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
        GetMyStatisticQueryHandler,

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
    queryHandler = module.get<GetMyStatisticQueryHandler>(GetMyStatisticQueryHandler);

    gamesQueryRepository = module.get<GamesQueryRepository>(GamesQueryRepository);

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

  const createFinishedGameWithPlayers = async (
    hostId: number,
    playerId: number,
  ): Promise<{ game: Game; players: Player[] }> => {
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
    createdGame.finishGame();
    const finishedGame: Game = await gameRepo.save(createdGame);

    return { game: finishedGame, players: createdPlayers };
  };

  const createActiveGameWithPlayers = async (
    hostId: number,
    playerId: number,
  ): Promise<{ game: Game; players: Player[] }> => {
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

  const createPendingGameWithOnePlayer = async (
    userId: number,
  ): Promise<{ game: Game; player: Player }> => {
    const game: Game = Game.create();
    const createdGame: Game = await gameRepo.save(game);

    const player: Player = Player.create(userId, createdGame.id);
    player.updateRole(GameRole.Host);
    const createdPlayer: Player = await playerRepo.save(player);

    return { game: createdGame, player: createdPlayer };
  };

  const setPlayerScore = async (playerId: number, score: number): Promise<void> => {
    const player: Player | null = await playerRepo.findOne({ where: { id: playerId } });
    if (player) {
      for (let i = 0; i < score; i++) {
        player.addScore();
      }

      await playerRepo.save(player);
    }
  };

  describe('Позитивные сценарии', () => {
    describe('Пользователь без завершённых игр', () => {
      it('должен вернуть нулевую статистику для пользователя без завершённых игр', async () => {
        const user: User = await createTestUser({
          login: 'test_user',
          email: 'test_user@example.com',
        });

        const statistic: StatisticViewDto = await queryHandler.execute(
          new GetMyStatisticQuery(user.id),
        );

        expect(statistic).toBeDefined();
        expect(statistic.sumScore).toBe(0);
        expect(statistic.avgScores).toBe(0);
        expect(statistic.gamesCount).toBe(0);
        expect(statistic.winsCount).toBe(0);
        expect(statistic.lossesCount).toBe(0);
        expect(statistic.drawsCount).toBe(0);
      });

      it('должен вернуть нулевую статистику для пользователя с играми в статусе Pending', async () => {
        const user: User = await createTestUser({
          login: 'test_user',
          email: 'test_user@example.com',
        });
        await createPendingGameWithOnePlayer(user.id);

        const statistic: StatisticViewDto = await queryHandler.execute(
          new GetMyStatisticQuery(user.id),
        );

        expect(statistic.sumScore).toBe(0);
        expect(statistic.avgScores).toBe(0);
        expect(statistic.gamesCount).toBe(0);
        expect(statistic.winsCount).toBe(0);
        expect(statistic.lossesCount).toBe(0);
        expect(statistic.drawsCount).toBe(0);
      });

      it('должен вернуть нулевую статистику для пользователя с играми в статусе Active', async () => {
        const user: User = await createTestUser({
          login: 'test_user',
          email: 'test_user@example.com',
        });
        const opponent: User = await createTestUser({
          login: 'opponent',
          email: 'opponent@example.com',
        });
        await createActiveGameWithPlayers(user.id, opponent.id);

        const statistic: StatisticViewDto = await queryHandler.execute(
          new GetMyStatisticQuery(user.id),
        );

        expect(statistic.sumScore).toBe(0);
        expect(statistic.avgScores).toBe(0);
        expect(statistic.gamesCount).toBe(0);
        expect(statistic.winsCount).toBe(0);
        expect(statistic.lossesCount).toBe(0);
        expect(statistic.drawsCount).toBe(0);
      });
    });

    describe('Статистика с одной завершённой игрой', () => {
      it('должен корректно посчитать статистику при одной победе (score: 5 vs 3)', async () => {
        const user: User = await createTestUser({
          login: 'test_user',
          email: 'test_user@example.com',
        });
        const opponent: User = await createTestUser({
          login: 'opponent',
          email: 'opponent@example.com',
        });
        const { players } = await createFinishedGameWithPlayers(user.id, opponent.id);

        await setPlayerScore(players[0].id, 5);
        await setPlayerScore(players[1].id, 3);

        const statistic: StatisticViewDto = await queryHandler.execute(
          new GetMyStatisticQuery(user.id),
        );

        expect(statistic.sumScore).toBe(5);
        expect(statistic.avgScores).toBe(5);
        expect(statistic.gamesCount).toBe(1);
        expect(statistic.winsCount).toBe(1);
        expect(statistic.lossesCount).toBe(0);
        expect(statistic.drawsCount).toBe(0);
      });

      it('должен корректно посчитать статистику при одном поражении (score: 2 vs 6)', async () => {
        const user: User = await createTestUser({
          login: 'test_user',
          email: 'test_user@example.com',
        });
        const opponent: User = await createTestUser({
          login: 'opponent',
          email: 'opponent@example.com',
        });
        const { players } = await createFinishedGameWithPlayers(user.id, opponent.id);

        await setPlayerScore(players[0].id, 2);
        await setPlayerScore(players[1].id, 6);

        const statistic: StatisticViewDto = await queryHandler.execute(
          new GetMyStatisticQuery(user.id),
        );

        expect(statistic.sumScore).toBe(2);
        expect(statistic.avgScores).toBe(2);
        expect(statistic.gamesCount).toBe(1);
        expect(statistic.winsCount).toBe(0);
        expect(statistic.lossesCount).toBe(1);
        expect(statistic.drawsCount).toBe(0);
      });

      it('должен корректно посчитать статистику при ничьей (score: 4 vs 4)', async () => {
        const user: User = await createTestUser({
          login: 'test_user',
          email: 'test_user@example.com',
        });
        const opponent: User = await createTestUser({
          login: 'opponent',
          email: 'opponent@example.com',
        });
        const { players } = await createFinishedGameWithPlayers(user.id, opponent.id);

        await setPlayerScore(players[0].id, 4);
        await setPlayerScore(players[1].id, 4);

        const statistic: StatisticViewDto = await queryHandler.execute(
          new GetMyStatisticQuery(user.id),
        );

        expect(statistic.sumScore).toBe(4);
        expect(statistic.avgScores).toBe(4);
        expect(statistic.gamesCount).toBe(1);
        expect(statistic.winsCount).toBe(0);
        expect(statistic.lossesCount).toBe(0);
        expect(statistic.drawsCount).toBe(1);
      });

      it('должен корректно посчитать статистику при счёте 0:0 (ничья)', async () => {
        const user: User = await createTestUser({
          login: 'test_user',
          email: 'test_user@example.com',
        });
        const opponent: User = await createTestUser({
          login: 'opponent',
          email: 'opponent@example.com',
        });
        await createFinishedGameWithPlayers(user.id, opponent.id);

        const statistic: StatisticViewDto = await queryHandler.execute(
          new GetMyStatisticQuery(user.id),
        );

        expect(statistic.sumScore).toBe(0);
        expect(statistic.avgScores).toBe(0);
        expect(statistic.gamesCount).toBe(1);
        expect(statistic.winsCount).toBe(0);
        expect(statistic.lossesCount).toBe(0);
        expect(statistic.drawsCount).toBe(1);
      });
    });

    describe('Статистика с множественными играми', () => {
      it('должен корректно посчитать статистику при множественных победах (3 игры)', async () => {
        const user: User = await createTestUser({
          login: 'test_user',
          email: 'test_user@example.com',
        });

        // Игра 1: 6 vs 3
        const opponent1: User = await createTestUser({
          login: 'opponent1',
          email: 'opponent1@example.com',
        });
        const { players: players1 } = await createFinishedGameWithPlayers(user.id, opponent1.id);
        await setPlayerScore(players1[0].id, 6);
        await setPlayerScore(players1[1].id, 3);

        // Игра 2: 5 vs 2
        const opponent2: User = await createTestUser({
          login: 'opponent2',
          email: 'opponent2@example.com',
        });
        const { players: players2 } = await createFinishedGameWithPlayers(user.id, opponent2.id);
        await setPlayerScore(players2[0].id, 5);
        await setPlayerScore(players2[1].id, 2);

        // Игра 3: 4 vs 1
        const opponent3: User = await createTestUser({
          login: 'opponent3',
          email: 'opponent3@example.com',
        });
        const { players: players3 } = await createFinishedGameWithPlayers(user.id, opponent3.id);
        await setPlayerScore(players3[0].id, 4);
        await setPlayerScore(players3[1].id, 1);

        const statistic: StatisticViewDto = await queryHandler.execute(
          new GetMyStatisticQuery(user.id),
        );

        expect(statistic.sumScore).toBe(15);
        expect(statistic.avgScores).toBe(5);
        expect(statistic.gamesCount).toBe(3);
        expect(statistic.winsCount).toBe(3);
        expect(statistic.lossesCount).toBe(0);
        expect(statistic.drawsCount).toBe(0);
      });

      it('должен корректно посчитать статистику при множественных поражениях (3 игры)', async () => {
        const user: User = await createTestUser({
          login: 'test_user',
          email: 'test_user@example.com',
        });

        // Игра 1: 2 vs 5
        const opponent1: User = await createTestUser({
          login: 'opponent1',
          email: 'opponent1@example.com',
        });
        const { players: players1 } = await createFinishedGameWithPlayers(user.id, opponent1.id);
        await setPlayerScore(players1[0].id, 2);
        await setPlayerScore(players1[1].id, 5);

        // Игра 2: 1 vs 6
        const opponent2: User = await createTestUser({
          login: 'opponent2',
          email: 'opponent2@example.com',
        });
        const { players: players2 } = await createFinishedGameWithPlayers(user.id, opponent2.id);
        await setPlayerScore(players2[0].id, 1);
        await setPlayerScore(players2[1].id, 6);

        // Игра 3: 3 vs 4
        const opponent3: User = await createTestUser({
          login: 'opponent3',
          email: 'opponent3@example.com',
        });
        const { players: players3 } = await createFinishedGameWithPlayers(user.id, opponent3.id);
        await setPlayerScore(players3[0].id, 3);
        await setPlayerScore(players3[1].id, 4);

        const statistic: StatisticViewDto = await queryHandler.execute(
          new GetMyStatisticQuery(user.id),
        );

        expect(statistic.sumScore).toBe(6);
        expect(statistic.avgScores).toBe(2);
        expect(statistic.gamesCount).toBe(3);
        expect(statistic.winsCount).toBe(0);
        expect(statistic.lossesCount).toBe(3);
        expect(statistic.drawsCount).toBe(0);
      });

      it('должен корректно посчитать статистику при смешанных результатах (2 победы, 1 поражение, 2 ничьи)', async () => {
        const user: User = await createTestUser({
          login: 'test_user',
          email: 'test_user@example.com',
        });

        // Победа 1: 6 vs 3
        const opponent1: User = await createTestUser({
          login: 'opponent1',
          email: 'opponent1@example.com',
        });
        const { players: p1 } = await createFinishedGameWithPlayers(user.id, opponent1.id);
        await setPlayerScore(p1[0].id, 6);
        await setPlayerScore(p1[1].id, 3);

        // Победа 2: 5 vs 2
        const opponent2: User = await createTestUser({
          login: 'opponent2',
          email: 'opponent2@example.com',
        });
        const { players: p2 } = await createFinishedGameWithPlayers(user.id, opponent2.id);
        await setPlayerScore(p2[0].id, 5);
        await setPlayerScore(p2[1].id, 2);

        // Поражение: 1 vs 4
        const opponent3: User = await createTestUser({
          login: 'opponent3',
          email: 'opponent3@example.com',
        });
        const { players: p3 } = await createFinishedGameWithPlayers(user.id, opponent3.id);
        await setPlayerScore(p3[0].id, 1);
        await setPlayerScore(p3[1].id, 4);

        // Ничья 1: 3 vs 3
        const opponent4: User = await createTestUser({
          login: 'opponent4',
          email: 'opponent4@example.com',
        });
        const { players: p4 } = await createFinishedGameWithPlayers(user.id, opponent4.id);
        await setPlayerScore(p4[0].id, 3);
        await setPlayerScore(p4[1].id, 3);

        // Ничья 2: 2 vs 2
        const opponent5: User = await createTestUser({
          login: 'opponent5',
          email: 'opponent5@example.com',
        });
        const { players: p5 } = await createFinishedGameWithPlayers(user.id, opponent5.id);
        await setPlayerScore(p5[0].id, 2);
        await setPlayerScore(p5[1].id, 2);

        const statistic: StatisticViewDto = await queryHandler.execute(
          new GetMyStatisticQuery(user.id),
        );

        expect(statistic.sumScore).toBe(17);
        expect(statistic.avgScores).toBe(3.4);
        expect(statistic.gamesCount).toBe(5);
        expect(statistic.winsCount).toBe(2);
        expect(statistic.lossesCount).toBe(1);
        expect(statistic.drawsCount).toBe(2);
      });

      it('должен корректно округлять avgScores до 2 знаков после запятой', async () => {
        const user: User = await createTestUser({
          login: 'test_user',
          email: 'test_user@example.com',
        });

        // Игра 1: 5
        const opponent1: User = await createTestUser({
          login: 'opponent1',
          email: 'opponent@example.com',
        });
        const { players: p1 } = await createFinishedGameWithPlayers(user.id, opponent1.id);
        await setPlayerScore(p1[0].id, 5);

        // Игра 2: 4
        const opponent2: User = await createTestUser({
          login: 'opponent2',
          email: 'opponent2@example.com',
        });
        const { players: p2 } = await createFinishedGameWithPlayers(user.id, opponent2.id);
        await setPlayerScore(p2[0].id, 4);

        // Игра 3: 2
        const opponent3: User = await createTestUser({
          login: 'opponent3',
          email: 'opponent3@example.com',
        });
        const { players: p3 } = await createFinishedGameWithPlayers(user.id, opponent3.id);
        await setPlayerScore(p3[0].id, 2);

        const statistic: StatisticViewDto = await queryHandler.execute(
          new GetMyStatisticQuery(user.id),
        );

        expect(statistic.sumScore).toBe(11);
        expect(statistic.avgScores).toBe(3.67);
        expect(statistic.gamesCount).toBe(3);
      });
    });

    describe('Пользователь в разных ролях', () => {
      it('должен корректно посчитать статистику когда пользователь был Host', async () => {
        const user: User = await createTestUser({
          login: 'test_user',
          email: 'test_user@example.com',
        });
        const opponent: User = await createTestUser({
          login: 'opponent',
          email: 'opponent@example.com',
        });
        const { players } = await createFinishedGameWithPlayers(user.id, opponent.id);

        await setPlayerScore(players[0].id, 5);
        await setPlayerScore(players[1].id, 2);

        const statistic: StatisticViewDto = await queryHandler.execute(
          new GetMyStatisticQuery(user.id),
        );

        expect(statistic.sumScore).toBe(5);
        expect(statistic.winsCount).toBe(1);
        expect(statistic.gamesCount).toBe(1);
      });

      it('должен корректно посчитать статистику когда пользователь был Player', async () => {
        const user: User = await createTestUser({
          login: 'test_user',
          email: 'test_user@example.com',
        });
        const opponent: User = await createTestUser({
          login: 'opponent',
          email: 'opponent@example.com',
        });
        const { players } = await createFinishedGameWithPlayers(opponent.id, user.id);

        await setPlayerScore(players[0].id, 2);
        await setPlayerScore(players[1].id, 6);

        const statistic: StatisticViewDto = await queryHandler.execute(
          new GetMyStatisticQuery(user.id),
        );

        expect(statistic.sumScore).toBe(6);
        expect(statistic.winsCount).toBe(1);
        expect(statistic.gamesCount).toBe(1);
      });

      it('должен корректно посчитать статистику когда пользователь был в разных ролях (Host и Player)', async () => {
        const user: User = await createTestUser({
          login: 'test_user',
          email: 'test_user@example.com',
        });
        const opponent1: User = await createTestUser({
          login: 'opponent1',
          email: 'opponent1@example.com',
        });
        const opponent2: User = await createTestUser({
          login: 'opponent2',
          email: 'opponent2@example.com',
        });

        // Игра 1: user - Host, победа (5 vs 2)
        const { players: p1 } = await createFinishedGameWithPlayers(user.id, opponent1.id);
        await setPlayerScore(p1[0].id, 5);
        await setPlayerScore(p1[1].id, 2);

        // Игра 2: user - Player, поражение (3 vs 6)
        const { players: p2 } = await createFinishedGameWithPlayers(opponent2.id, user.id);
        await setPlayerScore(p2[0].id, 6);
        await setPlayerScore(p2[1].id, 3);

        const statistic: StatisticViewDto = await queryHandler.execute(
          new GetMyStatisticQuery(user.id),
        );

        expect(statistic.sumScore).toBe(8);
        expect(statistic.avgScores).toBe(4);
        expect(statistic.gamesCount).toBe(2);
        expect(statistic.winsCount).toBe(1);
        expect(statistic.lossesCount).toBe(1);
        expect(statistic.drawsCount).toBe(0);
      });
    });

    describe('Игры с разными статусами (проверка фильтрации)', () => {
      it('должен учитывать только Finished игры и игнорировать Pending/Active', async () => {
        const user: User = await createTestUser({
          login: 'test_user',
          email: 'test_user@example.com',
        });
        const opponent1: User = await createTestUser({
          login: 'opponent1',
          email: 'opponent1@example.com',
        });
        const opponent2: User = await createTestUser({
          login: 'opponent2',
          email: 'opponent2@example.com',
        });

        // Pending игра (не должна учитываться)
        await createPendingGameWithOnePlayer(user.id);

        // Active игра (не должна учитываться)
        await createActiveGameWithPlayers(user.id, opponent1.id);

        // Finished игра (должна учитываться)
        const { players } = await createFinishedGameWithPlayers(user.id, opponent2.id);
        await setPlayerScore(players[0].id, 4);
        await setPlayerScore(players[1].id, 2);

        const statistic: StatisticViewDto = await queryHandler.execute(
          new GetMyStatisticQuery(user.id),
        );

        // Assert: учитывается только 1 Finished игра
        expect(statistic.sumScore).toBe(4);
        expect(statistic.avgScores).toBe(4);
        expect(statistic.gamesCount).toBe(1);
        expect(statistic.winsCount).toBe(1);
      });
    });
  });

  describe('Негативные сценарии', () => {
    describe('Несуществующий пользователь', () => {
      it('должен вернуть нулевую статистику для несуществующего userId', async () => {
        const nonExistentUserId = 99999;

        // Создаём игры с другими пользователями (для контекста)
        const user1: User = await createTestUser({
          login: 'test_user1',
          email: 'test_user1@example.com',
        });
        const user2: User = await createTestUser({
          login: 'test_user2',
          email: 'test_user2@example.com',
        });
        await createFinishedGameWithPlayers(user1.id, user2.id);

        const statistic: StatisticViewDto = await queryHandler.execute(
          new GetMyStatisticQuery(nonExistentUserId),
        );

        // Assert: должна вернуться нулевая статистика
        expect(statistic.sumScore).toBe(0);
        expect(statistic.avgScores).toBe(0);
        expect(statistic.gamesCount).toBe(0);
        expect(statistic.winsCount).toBe(0);
        expect(statistic.lossesCount).toBe(0);
        expect(statistic.drawsCount).toBe(0);
      });
    });

    describe('Изоляция данных пользователей', () => {
      it('НЕ должен включать игры других пользователей в статистику', async () => {
        // Arrange: создаём двух пользователей с отдельными играми
        const user1: User = await createTestUser({
          login: 'test_user1',
          email: 'test_user1@example.com',
        });
        const user2: User = await createTestUser({
          login: 'test_user2',
          email: 'test_user2@example.com',
        });
        const opponent1: User = await createTestUser({
          login: 'opponent1',
          email: 'opponent1@example.com',
        });
        const opponent2: User = await createTestUser({
          login: 'opponent2',
          email: 'opponent2@example.com',
        });

        // Игры для user1 (счёт 5)
        const { players: p1 } = await createFinishedGameWithPlayers(user1.id, opponent1.id);
        await setPlayerScore(p1[0].id, 5);

        // Игры для user2 (счёт 10) - не должны попасть в статистику user1
        const { players: p2 } = await createFinishedGameWithPlayers(user2.id, opponent2.id);
        await setPlayerScore(p2[0].id, 10);

        // Act: запрашиваем статистику для user1
        const statistic: StatisticViewDto = await queryHandler.execute(
          new GetMyStatisticQuery(user1.id),
        );

        // Assert: должна учитываться только игра user1
        expect(statistic.sumScore).toBe(5);
        expect(statistic.avgScores).toBe(5);
        expect(statistic.gamesCount).toBe(1);
      });
    });
  });
});
