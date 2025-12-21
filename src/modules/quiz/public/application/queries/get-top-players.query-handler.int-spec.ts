import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, Repository } from 'typeorm';
import { TypeOrmModule } from '@nestjs/typeorm';

import { GetTopPlayersQuery, GetTopPlayersQueryHandler } from './get-top-players.query-handler';

import { DatabaseModule } from '../../../../database/database.module';
import { configModule } from '../../../../../dynamic-config.module';

import { Game } from '../../domain/entities/game.entity';
import { GameRole, Player } from '../../domain/entities/player.entity';
import { User } from '../../../../user-accounts/users/domain/entities/user.entity';

import { GamesQueryRepository } from '../../infrastructure/query/games.query-repository';
import { PlayersRepository } from '../../infrastructure/players.repository';
import { getRelatedEntities } from '../../../../../core/utils/get-related-entities.utility';
import { UserInputDto } from '../../../../user-accounts/users/api/input-dto/user.input-dto';
import { CreateUserDto } from '../../../../user-accounts/users/dto/create-user.dto';
import { UsersFactory } from '../../../../user-accounts/users/application/factories/users.factory';
import { CryptoService } from '../../../../user-accounts/users/application/services/crypto.service';
import { DateService } from '../../../../user-accounts/users/application/services/date.service';
import { GetTopPlayersQueryParams } from '../../api/input-dto/get-top-players-query-params.input-dto';
import { PaginatedViewDto } from '../../../../../core/dto/paginated.view-dto';
import { TopGamePlayerViewDto } from '../../api/view-dto/top-game-player-view.dto';
import { TransactionHelper } from '../../../../database/trasaction.helper';

describe('GetTopPlayersQueryHandler (Integration)', () => {
  let module: TestingModule;
  let dataSource: DataSource;

  let queryHandler: GetTopPlayersQueryHandler;
  let usersFactory: UsersFactory;

  let gameRepo: Repository<Game>;
  let playerRepo: Repository<Player>;
  let userRepo: Repository<User>;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [configModule, DatabaseModule, TypeOrmModule.forFeature(getRelatedEntities(Game))],
      providers: [
        GetTopPlayersQueryHandler,

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
    queryHandler = module.get<GetTopPlayersQueryHandler>(GetTopPlayersQueryHandler);

    gameRepo = dataSource.getRepository(Game);
    playerRepo = dataSource.getRepository(Player);
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
    describe('Базовый функционал', () => {
      it('должен вернуть пустой список если нет игроков с завершёнными играми', async () => {
        const queryParams: GetTopPlayersQueryParams = new GetTopPlayersQueryParams();

        const result: PaginatedViewDto<TopGamePlayerViewDto> = await queryHandler.execute(
          new GetTopPlayersQuery(queryParams),
        );

        expect(result).toBeDefined();
        expect(result.items).toEqual([]);
        expect(result.totalCount).toBe(0);
        expect(result.pagesCount).toBe(0);
        expect(result.page).toBe(1);
        expect(result.pageSize).toBe(10);
      });

      it('должен вернуть топ игрока с одной завершённой игрой', async () => {
        const user1: User = await createTestUser({
          login: 'player1',
          email: 'player1@example.com',
        });
        const user2: User = await createTestUser({
          login: 'player2',
          email: 'player2@example.com',
        });
        const { players } = await createFinishedGameWithPlayers(user1.id, user2.id);

        await setPlayerScore(players[0].id, 5);
        await setPlayerScore(players[1].id, 3);

        const queryParams: GetTopPlayersQueryParams = new GetTopPlayersQueryParams();

        const result: PaginatedViewDto<TopGamePlayerViewDto> = await queryHandler.execute(
          new GetTopPlayersQuery(queryParams),
        );

        expect(result.items).toHaveLength(2);
        expect(result.totalCount).toBe(2);

        const topPlayer: TopGamePlayerViewDto = result.items[0];
        expect(topPlayer.player.id).toBe(user1.id.toString());
        expect(topPlayer.player.login).toBe(user1.login);
        expect(topPlayer.sumScore).toBe(5);
        expect(topPlayer.avgScores).toBe(5);
        expect(topPlayer.gamesCount).toBe(1);
        expect(topPlayer.winsCount).toBe(1);
        expect(topPlayer.lossesCount).toBe(0);
        expect(topPlayer.drawsCount).toBe(0);

        const secondPlayer: TopGamePlayerViewDto = result.items[1];
        expect(secondPlayer.player.id).toBe(user2.id.toString());
        expect(secondPlayer.sumScore).toBe(3);
        expect(secondPlayer.avgScores).toBe(3);
        expect(secondPlayer.gamesCount).toBe(1);
        expect(secondPlayer.winsCount).toBe(0);
        expect(secondPlayer.lossesCount).toBe(1);
        expect(secondPlayer.drawsCount).toBe(0);
      });

      it('должен корректно посчитать статистику для игрока с множественными играми', async () => {
        const topUser: User = await createTestUser({
          login: 'top_player',
          email: 'top_player@example.com',
        });

        const opponent1: User = await createTestUser({
          login: 'opponent1',
          email: 'opponent1@example.com',
        });
        const { players: p1 } = await createFinishedGameWithPlayers(topUser.id, opponent1.id);
        await setPlayerScore(p1[0].id, 6);
        await setPlayerScore(p1[1].id, 2);

        const opponent2: User = await createTestUser({
          login: 'opponent2',
          email: 'opponent2@example.com',
        });
        const { players: p2 } = await createFinishedGameWithPlayers(topUser.id, opponent2.id);
        await setPlayerScore(p2[0].id, 5);
        await setPlayerScore(p2[1].id, 3);

        const opponent3: User = await createTestUser({
          login: 'opponent3',
          email: 'opponent3@example.com',
        });
        const { players: p3 } = await createFinishedGameWithPlayers(topUser.id, opponent3.id);
        await setPlayerScore(p3[0].id, 2);
        await setPlayerScore(p3[1].id, 4);

        const queryParams: GetTopPlayersQueryParams = new GetTopPlayersQueryParams();

        const result: PaginatedViewDto<TopGamePlayerViewDto> = await queryHandler.execute(
          new GetTopPlayersQuery(queryParams),
        );

        const topPlayerStat: TopGamePlayerViewDto | undefined = result.items.find(
          (item) => item.player.id === topUser.id.toString(),
        );

        expect(topPlayerStat).toBeDefined();
        expect(topPlayerStat!.sumScore).toBe(13);
        expect(topPlayerStat!.avgScores).toBe(4.33);
        expect(topPlayerStat!.gamesCount).toBe(3);
        expect(topPlayerStat!.winsCount).toBe(2);
        expect(topPlayerStat!.lossesCount).toBe(1);
        expect(topPlayerStat!.drawsCount).toBe(0);
      });
    });

    describe('Сортировка по умолчанию (avgScores DESC, sumScore DESC)', () => {
      it('должен отсортировать игроков по avgScores DESC, затем по sumScore DESC', async () => {
        const user1: User = await createTestUser({
          login: 'user_avg_6',
          email: 'user_avg_6@example.com',
        });
        const user2: User = await createTestUser({
          login: 'user_avg_5',
          email: 'user_avg_5@example.com',
        });
        const user3: User = await createTestUser({
          login: 'user_avg_4',
          email: 'user_avg_4@example.com',
        });

        // user1: avgScore = 6 (одна игра, счёт 6)
        const opp1: User = await createTestUser({ login: 'opp1', email: 'opp1@example.com' });
        const { players: p1 } = await createFinishedGameWithPlayers(user1.id, opp1.id);
        await setPlayerScore(p1[0].id, 6);

        // user2: avgScore = 5 (одна игра, счёт 5)
        const opp2: User = await createTestUser({ login: 'opp2', email: 'opp2@example.com' });
        const { players: p2 } = await createFinishedGameWithPlayers(user2.id, opp2.id);
        await setPlayerScore(p2[0].id, 5);

        // user3: avgScore = 4 (одна игра, счёт 4)
        const opp3: User = await createTestUser({ login: 'opp3', email: 'opp3@example.com' });
        const { players: p3 } = await createFinishedGameWithPlayers(user3.id, opp3.id);
        await setPlayerScore(p3[0].id, 4);

        const queryParams: GetTopPlayersQueryParams = new GetTopPlayersQueryParams();
        const result: PaginatedViewDto<TopGamePlayerViewDto> = await queryHandler.execute(
          new GetTopPlayersQuery(queryParams),
        );

        const user1Index = result.items.findIndex((item) => item.player.id === user1.id.toString());
        const user2Index = result.items.findIndex((item) => item.player.id === user2.id.toString());
        const user3Index = result.items.findIndex((item) => item.player.id === user3.id.toString());

        expect(user1Index).toBeLessThan(user2Index);
        expect(user2Index).toBeLessThan(user3Index);

        expect(result.items[user1Index].avgScores).toBe(6);
        expect(result.items[user2Index].avgScores).toBe(5);
        expect(result.items[user3Index].avgScores).toBe(4);
      });

      it('должен использовать sumScore как вторичную сортировку при одинаковом avgScores', async () => {
        // создаём 2 игроков с ОДИНАКОВЫМ avgScores = 5, но РАЗНЫМ sumScore

        // user1: avgScore = 5, sumScore = 10 (2 игры по 5 очков)
        const user1: User = await createTestUser({
          login: 'user_sum10',
          email: 'user_sum10@example.com',
        });

        const opp1a: User = await createTestUser({
          login: 'opp1a',
          email: 'opp1a@example.com',
        });
        const { players: p1a } = await createFinishedGameWithPlayers(user1.id, opp1a.id);
        await setPlayerScore(p1a[0].id, 5);

        const opp1b: User = await createTestUser({
          login: 'opp1b',
          email: 'opp1b@example.com',
        });
        const { players: p1b } = await createFinishedGameWithPlayers(user1.id, opp1b.id);
        await setPlayerScore(p1b[0].id, 5);

        // user2: avgScore = 5, sumScore = 5 (1 игра с 5 очками)
        const user2: User = await createTestUser({
          login: 'user_sum5',
          email: 'user_sum5@example.com',
        });

        const opp2: User = await createTestUser({
          login: 'opp2',
          email: 'opp2@example.com',
        });
        const { players: p2 } = await createFinishedGameWithPlayers(user2.id, opp2.id);
        await setPlayerScore(p2[0].id, 5);

        // Query params с дефолтной сортировкой: avgScores desc, sumScore desc
        const queryParams: GetTopPlayersQueryParams = new GetTopPlayersQueryParams();

        const result: PaginatedViewDto<TopGamePlayerViewDto> = await queryHandler.execute(
          new GetTopPlayersQuery(queryParams),
        );

        const targetPlayers: TopGamePlayerViewDto[] = result.items.filter((item) =>
          [user1.id.toString(), user2.id.toString()].includes(item.player.id),
        );

        expect(targetPlayers).toHaveLength(2);

        // Проверяем что оба имеют одинаковый avgScores = 5
        expect(targetPlayers[0].avgScores).toBe(5);
        expect(targetPlayers[1].avgScores).toBe(5);

        // Проверяем порядок: user1 должен быть ПЕРЕД user2 (т.к. sumScore 10 > 5)
        const user1Index: number = result.items.findIndex(
          (item) => item.player.id === user1.id.toString(),
        );
        const user2Index: number = result.items.findIndex(
          (item) => item.player.id === user2.id.toString(),
        );

        expect(user1Index).toBeLessThan(user2Index);

        // Проверяем значения
        const user1Stat: TopGamePlayerViewDto = result.items[user1Index];
        expect(user1Stat.sumScore).toBe(10);
        expect(user1Stat.avgScores).toBe(5);
        expect(user1Stat.gamesCount).toBe(2);

        const user2Stat: TopGamePlayerViewDto = result.items[user2Index];
        expect(user2Stat.sumScore).toBe(5);
        expect(user2Stat.avgScores).toBe(5);
        expect(user2Stat.gamesCount).toBe(1);
      });
    });

    describe('Кастомная сортировка', () => {
      it('должен отсортировать по winsCount DESC', async () => {
        const winner: User = await createTestUser({
          login: 'winner',
          email: 'winner@example.com',
        });
        const loser: User = await createTestUser({
          login: 'loser',
          email: 'loser@example.com',
        });

        // winner: 2 победы
        const opp1: User = await createTestUser({ login: 'opp_w1', email: 'opp_w1@example.com' });
        const { players: pw1 } = await createFinishedGameWithPlayers(winner.id, opp1.id);
        await setPlayerScore(pw1[0].id, 5);
        await setPlayerScore(pw1[1].id, 2);

        const opp2: User = await createTestUser({ login: 'opp_w2', email: 'opp_w2@example.com' });
        const { players: pw2 } = await createFinishedGameWithPlayers(winner.id, opp2.id);
        await setPlayerScore(pw2[0].id, 4);
        await setPlayerScore(pw2[1].id, 1);

        // loser: 0 побед, 1 поражение
        const opp3: User = await createTestUser({ login: 'opp_l1', email: 'opp_l1@example.com' });
        const { players: pl1 } = await createFinishedGameWithPlayers(loser.id, opp3.id);
        await setPlayerScore(pl1[0].id, 1);
        await setPlayerScore(pl1[1].id, 6);

        const queryParams: GetTopPlayersQueryParams = new GetTopPlayersQueryParams();
        queryParams.sort = ['winsCount desc'];

        const result: PaginatedViewDto<TopGamePlayerViewDto> = await queryHandler.execute(
          new GetTopPlayersQuery(queryParams),
        );

        // Assert: winner должен быть выше loser
        const winnerIndex: number = result.items.findIndex(
          (item) => item.player.id === winner.id.toString(),
        );
        const loserIndex: number = result.items.findIndex(
          (item) => item.player.id === loser.id.toString(),
        );

        expect(winnerIndex).toBeLessThan(loserIndex);
        expect(result.items[winnerIndex].winsCount).toBe(2);
        expect(result.items[loserIndex].winsCount).toBe(0);
      });

      it('должен отсортировать по gamesCount ASC', async () => {
        const manyGames: User = await createTestUser({
          login: 'many_games',
          email: 'many_games@example.com',
        });
        const fewGames: User = await createTestUser({
          login: 'few_games',
          email: 'few_games@example.com',
        });

        // manyGames: 3 игры
        for (let i = 0; i < 3; i++) {
          const opp: User = await createTestUser({
            login: `opp_many_${i}`,
            email: `opp_many_${i}@example.com`,
          });
          const { players } = await createFinishedGameWithPlayers(manyGames.id, opp.id);
          await setPlayerScore(players[0].id, 3);
        }

        // fewGames: 1 игра
        const opp: User = await createTestUser({ login: 'opp_few', email: 'opp_few@example.com' });
        const { players } = await createFinishedGameWithPlayers(fewGames.id, opp.id);
        await setPlayerScore(players[0].id, 5);

        const queryParams: GetTopPlayersQueryParams = new GetTopPlayersQueryParams();
        queryParams.sort = ['gamesCount asc'];

        const result: PaginatedViewDto<TopGamePlayerViewDto> = await queryHandler.execute(
          new GetTopPlayersQuery(queryParams),
        );

        // Assert: fewGames должен быть выше manyGames (ASC)
        const fewIndex: number = result.items.findIndex(
          (item) => item.player.id === fewGames.id.toString(),
        );
        const manyIndex: number = result.items.findIndex(
          (item) => item.player.id === manyGames.id.toString(),
        );

        expect(fewIndex).toBeLessThan(manyIndex);
        expect(result.items[fewIndex].gamesCount).toBe(1);
        expect(result.items[manyIndex].gamesCount).toBe(3);
      });

      it('должен поддерживать множественную сортировку (winsCount desc, sumScore desc)', async () => {
        const user1: User = await createTestUser({
          login: 'user_1',
          email: 'user_1@example.com',
        });
        const user2: User = await createTestUser({
          login: 'user2',
          email: 'user2@example.com',
        });
        const user3: User = await createTestUser({
          login: 'user3',
          email: 'user3@example.com',
        });

        // user1: 2 победы, sumScore = 10
        const opp1a: User = await createTestUser({
          login: 'opp1a',
          email: 'opp1a@example.com',
        });
        const { players: p1a } = await createFinishedGameWithPlayers(user1.id, opp1a.id);
        await setPlayerScore(p1a[0].id, 6);
        await setPlayerScore(p1a[1].id, 2);

        const opp1b: User = await createTestUser({
          login: 'opp1b',
          email: 'opp1b@example.com',
        });
        const { players: p1b } = await createFinishedGameWithPlayers(user1.id, opp1b.id);
        await setPlayerScore(p1b[0].id, 4);
        await setPlayerScore(p1b[1].id, 1);

        // user2: 2 победы, sumScore = 8
        const opp2a: User = await createTestUser({
          login: 'opp2a',
          email: 'opp2a@example.com',
        });
        const { players: p2a } = await createFinishedGameWithPlayers(user2.id, opp2a.id);
        await setPlayerScore(p2a[0].id, 5);
        await setPlayerScore(p2a[1].id, 2);

        const opp2b: User = await createTestUser({
          login: 'opp2b',
          email: 'opp2b@example.com',
        });
        const { players: p2b } = await createFinishedGameWithPlayers(user2.id, opp2b.id);
        await setPlayerScore(p2b[0].id, 3);
        await setPlayerScore(p2b[1].id, 1);

        // user3: 1 победа, sumScore = 12
        const opp3: User = await createTestUser({
          login: 'opp3',
          email: 'opp3@example.com',
        });
        const { players: p3 } = await createFinishedGameWithPlayers(user3.id, opp3.id);
        await setPlayerScore(p3[0].id, 12);
        await setPlayerScore(p3[1].id, 5);

        const queryParams: GetTopPlayersQueryParams = new GetTopPlayersQueryParams();
        queryParams.sort = ['winsCount desc', 'sumScore desc'];

        const result: PaginatedViewDto<TopGamePlayerViewDto> = await queryHandler.execute(
          new GetTopPlayersQuery(queryParams),
        );

        // Assert: порядок должен быть user1, user2, user3
        const targetUsers: string[] = [
          user1.id.toString(),
          user2.id.toString(),
          user3.id.toString(),
        ];
        const filteredResults: TopGamePlayerViewDto[] = result.items.filter((item) =>
          targetUsers.includes(item.player.id),
        );

        expect(filteredResults[0].player.id).toBe(user1.id.toString());
        expect(filteredResults[0].winsCount).toBe(2);
        expect(filteredResults[0].sumScore).toBe(10);

        expect(filteredResults[1].player.id).toBe(user2.id.toString());
        expect(filteredResults[1].winsCount).toBe(2);
        expect(filteredResults[1].sumScore).toBe(8);

        expect(filteredResults[2].player.id).toBe(user3.id.toString());
        expect(filteredResults[2].winsCount).toBe(1);
        expect(filteredResults[2].sumScore).toBe(12);
      });
    });

    describe('Пагинация', () => {
      it('должен вернуть первую страницу с корректной пагинацией', async () => {
        const users: User[] = [];
        for (let i = 0; i < 15; i++) {
          const user: User = await createTestUser({
            login: `player_${i}`,
            email: `player_${i}@example.com`,
          });
          users.push(user);

          // Каждый играет с одним оппонентом
          const opponent: User = await createTestUser({
            login: `opp_${i}`,
            email: `opp_${i}@example.com`,
          });
          const { players } = await createFinishedGameWithPlayers(user.id, opponent.id);
          await setPlayerScore(players[0].id, i + 1);
        }

        const queryParams: GetTopPlayersQueryParams = new GetTopPlayersQueryParams();
        queryParams.pageNumber = 1;
        queryParams.pageSize = 10;

        const result: PaginatedViewDto<TopGamePlayerViewDto> = await queryHandler.execute(
          new GetTopPlayersQuery(queryParams),
        );

        expect(result.page).toBe(1);
        expect(result.pageSize).toBe(10);
        expect(result.totalCount).toBe(30); // 15 игроков + 15 оппонентов
        expect(result.pagesCount).toBe(3); // Math.ceil(30 / 10)
        expect(result.items).toHaveLength(10);
      });

      it('должен вернуть вторую страницу с корректной пагинацией', async () => {
        // создаём 15 игроков (всего 30 с оппонентами)
        for (let i = 0; i < 15; i++) {
          const user: User = await createTestUser({
            login: `player_${i}`,
            email: `player_${i}@example.com`,
          });
          const opponent: User = await createTestUser({
            login: `opp_${i}`,
            email: `opp_${i}@example.com`,
          });
          const { players } = await createFinishedGameWithPlayers(user.id, opponent.id);
          await setPlayerScore(players[0].id, 5);
        }

        const queryParams: GetTopPlayersQueryParams = new GetTopPlayersQueryParams();
        queryParams.pageNumber = 2;
        queryParams.pageSize = 10;

        const result: PaginatedViewDto<TopGamePlayerViewDto> = await queryHandler.execute(
          new GetTopPlayersQuery(queryParams),
        );

        expect(result.page).toBe(2);
        expect(result.pageSize).toBe(10);
        expect(result.totalCount).toBe(30);
        expect(result.pagesCount).toBe(3);
        expect(result.items).toHaveLength(10);
      });

      it('должен вернуть последнюю страницу с остатком элементов', async () => {
        // создаём 12 игроков (всего 24 с оппонентами)
        for (let i = 0; i < 12; i++) {
          const user: User = await createTestUser({
            login: `player_${i}`,
            email: `player_${i}@example.com`,
          });
          const opponent: User = await createTestUser({
            login: `opp_${i}`,
            email: `opp_${i}@example.com`,
          });
          const { players } = await createFinishedGameWithPlayers(user.id, opponent.id);
          await setPlayerScore(players[0].id, 3);
        }

        const queryParams: GetTopPlayersQueryParams = new GetTopPlayersQueryParams();
        queryParams.pageNumber = 3;
        queryParams.pageSize = 10;

        const result: PaginatedViewDto<TopGamePlayerViewDto> = await queryHandler.execute(
          new GetTopPlayersQuery(queryParams),
        );

        expect(result.page).toBe(3);
        expect(result.pageSize).toBe(10);
        expect(result.totalCount).toBe(24);
        expect(result.pagesCount).toBe(3); // Math.ceil(24 / 10) = 3
        expect(result.items).toHaveLength(4); // Остаток: 24 - 20 = 4
      });

      it('должен вернуть пустой массив если pageNumber превышает количество страниц', async () => {
        // создаём 2 игрока (всего 4 с оппонентами)
        for (let i = 0; i < 2; i++) {
          const user: User = await createTestUser({
            login: `player_${i}`,
            email: `player_${i}@example.com`,
          });
          const opponent: User = await createTestUser({
            login: `opp_${i}`,
            email: `opp_${i}@example.com`,
          });
          await createFinishedGameWithPlayers(user.id, opponent.id);
        }

        const queryParams: GetTopPlayersQueryParams = new GetTopPlayersQueryParams();
        queryParams.pageNumber = 10;
        queryParams.pageSize = 5;

        const result: PaginatedViewDto<TopGamePlayerViewDto> = await queryHandler.execute(
          new GetTopPlayersQuery(queryParams),
        );

        expect(result.page).toBe(10);
        expect(result.items).toEqual([]);
        expect(result.items).toHaveLength(0);
        expect(result.totalCount).toBe(4);
      });

      it('должен корректно работать с pageSize = 1', async () => {
        // создаём 3 игроков
        for (let i = 0; i < 3; i++) {
          const user: User = await createTestUser({
            login: `player_${i}`,
            email: `player_${i}@example.com`,
          });
          const opponent: User = await createTestUser({
            login: `opp_${i}`,
            email: `opp_${i}@example.com`,
          });
          await createFinishedGameWithPlayers(user.id, opponent.id);
        }

        const queryParams: GetTopPlayersQueryParams = new GetTopPlayersQueryParams();
        queryParams.pageNumber = 1;
        queryParams.pageSize = 1;

        const result: PaginatedViewDto<TopGamePlayerViewDto> = await queryHandler.execute(
          new GetTopPlayersQuery(queryParams),
        );

        expect(result.pageSize).toBe(1);
        expect(result.items).toHaveLength(1);
        expect(result.totalCount).toBe(6); // 3 игрока + 3 оппонента
        expect(result.pagesCount).toBe(6);
      });
    });

    describe('Фильтрация по статусу игры', () => {
      it('должен учитывать только Finished игры и игнорировать Active/Pending', async () => {
        // создаём игрока с играми в разных статусах
        const player: User = await createTestUser({
          login: 'player',
          email: 'player@example.com',
        });
        const opponent1: User = await createTestUser({
          login: 'opp1',
          email: 'opp1@example.com',
        });
        const opponent2: User = await createTestUser({
          login: 'opp2',
          email: 'opp2@example.com',
        });

        // Finished игра (должна учитываться)
        const { players: pFinished } = await createFinishedGameWithPlayers(player.id, opponent1.id);
        await setPlayerScore(pFinished[0].id, 5);

        // Active игра (не должна учитываться)
        await createActiveGameWithPlayers(player.id, opponent2.id);

        const queryParams: GetTopPlayersQueryParams = new GetTopPlayersQueryParams();

        const result: PaginatedViewDto<TopGamePlayerViewDto> = await queryHandler.execute(
          new GetTopPlayersQuery(queryParams),
        );

        // Assert: находим player в топе
        const playerStat: TopGamePlayerViewDto | undefined = result.items.find(
          (item) => item.player.id === player.id.toString(),
        );

        expect(playerStat).toBeDefined();
        expect(playerStat!.gamesCount).toBe(1); // Только Finished игра
        expect(playerStat!.sumScore).toBe(5);
      });
    });

    describe('Расчёт статистики', () => {
      it('должен корректно посчитать статистику с ничьими', async () => {
        // Arrange: создаём игрока с ничьими
        const player: User = await createTestUser({
          login: 'player',
          email: 'player@example.com',
        });
        const opponent: User = await createTestUser({
          login: 'opponent',
          email: 'opponent@example.com',
        });

        // Игра с ничьёй: 4 vs 4
        const { players } = await createFinishedGameWithPlayers(player.id, opponent.id);
        await setPlayerScore(players[0].id, 4);
        await setPlayerScore(players[1].id, 4);

        const queryParams: GetTopPlayersQueryParams = new GetTopPlayersQueryParams();

        // Act
        const result: PaginatedViewDto<TopGamePlayerViewDto> = await queryHandler.execute(
          new GetTopPlayersQuery(queryParams),
        );

        // Assert
        const playerStat: TopGamePlayerViewDto | undefined = result.items.find(
          (item) => item.player.id === player.id.toString(),
        );

        expect(playerStat).toBeDefined();
        expect(playerStat!.winsCount).toBe(0);
        expect(playerStat!.lossesCount).toBe(0);
        expect(playerStat!.drawsCount).toBe(1);
      });

      it('должен корректно округлять avgScores до 2 знаков после запятой', async () => {
        // Arrange: создаём игрока с играми для нецелого среднего
        const player: User = await createTestUser({
          login: 'player',
          email: 'player@example.com',
        });

        // Игра 1: score = 5
        const opp1: User = await createTestUser({
          login: 'opp1',
          email: 'opp1@example.com',
        });
        const { players: p1 } = await createFinishedGameWithPlayers(player.id, opp1.id);
        await setPlayerScore(p1[0].id, 5);

        // Игра 2: score = 4
        const opp2: User = await createTestUser({
          login: 'opp2',
          email: 'opp2@example.com',
        });
        const { players: p2 } = await createFinishedGameWithPlayers(player.id, opp2.id);
        await setPlayerScore(p2[0].id, 4);

        // Игра 3: score = 2
        const opp3: User = await createTestUser({
          login: 'opp3',
          email: 'opp3@example.com',
        });
        const { players: p3 } = await createFinishedGameWithPlayers(player.id, opp3.id);
        await setPlayerScore(p3[0].id, 2);

        const queryParams: GetTopPlayersQueryParams = new GetTopPlayersQueryParams();

        const result: PaginatedViewDto<TopGamePlayerViewDto> = await queryHandler.execute(
          new GetTopPlayersQuery(queryParams),
        );

        // 11 / 3 = 3.666... → округление до 3.67
        const playerStat: TopGamePlayerViewDto | undefined = result.items.find(
          (item) => item.player.id === player.id.toString(),
        );

        expect(playerStat).toBeDefined();
        expect(playerStat!.sumScore).toBe(11);
        expect(playerStat!.avgScores).toBe(3.67);
        expect(playerStat!.gamesCount).toBe(3);
      });
    });
  });

  describe('Изоляция данных пользователей', () => {
    it('должен показать каждого игрока только один раз в топе независимо от количества игр', async () => {
      // создаём игрока с 5 играми
      const player: User = await createTestUser({
        login: 'player',
        email: 'player@example.com',
      });

      for (let i = 0; i < 5; i++) {
        const opponent: User = await createTestUser({
          login: `opp_${i}`,
          email: `opp_${i}@example.com`,
        });
        const { players } = await createFinishedGameWithPlayers(player.id, opponent.id);
        await setPlayerScore(players[0].id, 3);
      }

      const queryParams: GetTopPlayersQueryParams = new GetTopPlayersQueryParams();

      const result: PaginatedViewDto<TopGamePlayerViewDto> = await queryHandler.execute(
        new GetTopPlayersQuery(queryParams),
      );

      // player должен встречаться только 1 раз
      const playerOccurrences: number = result.items.filter(
        (item) => item.player.id === player.id.toString(),
      ).length;

      expect(playerOccurrences).toBe(1);

      // Проверяем что статистика агрегирована корректно
      const playerStat: TopGamePlayerViewDto | undefined = result.items.find(
        (item) => item.player.id === player.id.toString(),
      );

      expect(playerStat!.gamesCount).toBe(5);
      expect(playerStat!.sumScore).toBe(15);
    });
  });
});
