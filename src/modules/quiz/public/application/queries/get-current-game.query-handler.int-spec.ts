import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, Repository } from 'typeorm';
import { TypeOrmModule } from '@nestjs/typeorm';

import { GetCurrentGameQuery, GetCurrentGameQueryHandler } from './get-current-game.query-handler';

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
import { GameViewDto } from '../../api/view-dto/game.view-dto';
import { UserInputDto } from '../../../../user-accounts/users/api/input-dto/user.input-dto';
import { CreateUserDto } from '../../../../user-accounts/users/dto/create-user.dto';
import { UsersFactory } from '../../../../user-accounts/users/application/factories/users.factory';
import { CryptoService } from '../../../../user-accounts/users/application/services/crypto.service';
import { DateService } from '../../../../user-accounts/users/application/services/date.service';
import { REQUIRED_QUESTIONS_COUNT } from '../../domain/constants/game.constants';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';
import { AnswerCreateDto } from '../../domain/dto/answer.create-dto';
import { TransactionHelper } from '../../../../../trasaction.helper';

describe('GetCurrentGameQueryHandler (Integration)', () => {
  let module: TestingModule;
  let dataSource: DataSource;

  let queryHandler: GetCurrentGameQueryHandler;
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
        GetCurrentGameQueryHandler,

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
    queryHandler = module.get<GetCurrentGameQueryHandler>(GetCurrentGameQueryHandler);

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
  ): Promise<{ game: Game; player: Player }> => {
    const game: Game = Game.create();
    const createdGame: Game = await gameRepo.save(game);

    const player: Player = Player.create(userId, createdGame.id);
    player.updateRole(GameRole.Host);
    const createdPlayer: Player = await playerRepo.save(player);

    return { game: createdGame, player: createdPlayer };
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
    describe('Пользователь находится в игре со статусом Pending', () => {
      it('должен успешно вернуть текущую игру для пользователя (Host) в статусе Pending (БЕЗ вопросов)', async () => {
        const { id: userId, login }: User = await createTestUser();
        const { game } = await createPendingGameWithOnePlayer(userId);

        const gameViewDto: GameViewDto = await queryHandler.execute(
          new GetCurrentGameQuery(userId),
        );

        expect(gameViewDto).toBeDefined();
        expect(gameViewDto).not.toBeNull();
        expect(gameViewDto.id).toBe(game.id.toString());
        expect(gameViewDto.status).toBe(GameStatus.Pending);
        expect(gameViewDto.pairCreatedDate).toBe(game.createdAt.toISOString());
        expect(gameViewDto.startGameDate).toBeNull();
        expect(gameViewDto.finishGameDate).toBeNull();

        expect(gameViewDto.firstPlayerProgress).toBeDefined();
        expect(gameViewDto.firstPlayerProgress).not.toBeNull();
        expect(gameViewDto.firstPlayerProgress.player.id).toBe(userId.toString());
        expect(gameViewDto.firstPlayerProgress.player.login).toBe(login);
        expect(gameViewDto.firstPlayerProgress.score).toBe(0);
        expect(gameViewDto.firstPlayerProgress.answers).toEqual([]);

        expect(gameViewDto.secondPlayerProgress).toBeNull();

        expect(gameViewDto.questions).toBeNull();
      });
    });

    describe('Пользователь находится в игре со статусом Active', () => {
      it('должен успешно вернуть текущую игру для первого игрока (Host) в статусе Active (БЕЗ ответов)', async () => {
        const { id: firstUserId, login: firstUserLogin }: User = await createTestUser({
          login: 'firstUser',
          email: 'firstUser@example.com',
        });
        const { id: secondUserId, login: secondUserLogin }: User = await createTestUser({
          login: 'secondUser',
          email: 'secondUser@example.com',
        });
        const { game } = await createActiveGameWithPlayers(firstUserId, secondUserId);
        const questions: Question[] =
          await createMultiplePublishedQuestions(REQUIRED_QUESTIONS_COUNT);
        await linkQuestionsToGame(game.id, questions);

        const gameViewDto: GameViewDto = await queryHandler.execute(
          new GetCurrentGameQuery(firstUserId),
        );

        expect(gameViewDto).toBeDefined();
        expect(gameViewDto).not.toBeNull();
        expect(gameViewDto.id).toBe(game.id.toString());
        expect(gameViewDto.status).toBe(GameStatus.Active);
        expect(gameViewDto.pairCreatedDate).toBe(game.createdAt.toISOString());
        expect(gameViewDto.startGameDate).toBe(game.startGameDate!.toISOString());
        expect(gameViewDto.finishGameDate).toBeNull();

        expect(gameViewDto.firstPlayerProgress).toBeDefined();
        expect(gameViewDto.firstPlayerProgress).not.toBeNull();
        expect(gameViewDto.firstPlayerProgress.player.id).toBe(firstUserId.toString());
        expect(gameViewDto.firstPlayerProgress.player.login).toBe(firstUserLogin);
        expect(gameViewDto.firstPlayerProgress.score).toBe(0);
        expect(gameViewDto.firstPlayerProgress.answers).toEqual([]);

        expect(gameViewDto.secondPlayerProgress).toBeDefined();
        expect(gameViewDto.secondPlayerProgress).not.toBeNull();
        expect(gameViewDto.secondPlayerProgress!.player.id).toBe(secondUserId.toString());
        expect(gameViewDto.secondPlayerProgress!.player.login).toBe(secondUserLogin);
        expect(gameViewDto.secondPlayerProgress!.score).toBe(0);
        expect(gameViewDto.secondPlayerProgress!.answers).toEqual([]);

        expect(gameViewDto.questions).toHaveLength(REQUIRED_QUESTIONS_COUNT);
        for (let i = 0; i < REQUIRED_QUESTIONS_COUNT; i++) {
          expect(gameViewDto.questions![i].id).toBe(questions[i].publicId);
          expect(gameViewDto.questions![i].body).toBe(questions[i].body);
        }
      });

      it('должен успешно вернуть текущую игру для второго игрока (Player) в статусе Active (БЕЗ ответов)', async () => {
        const { id: firstUserId, login: firstUserLogin }: User = await createTestUser({
          login: 'firstUser',
          email: 'firstUser@example.com',
        });
        const { id: secondUserId, login: secondUserLogin }: User = await createTestUser({
          login: 'secondUser',
          email: 'secondUser@example.com',
        });
        const { game } = await createActiveGameWithPlayers(firstUserId, secondUserId);
        const questions: Question[] =
          await createMultiplePublishedQuestions(REQUIRED_QUESTIONS_COUNT);
        await linkQuestionsToGame(game.id, questions);

        const gameViewDto: GameViewDto = await queryHandler.execute(
          new GetCurrentGameQuery(secondUserId),
        );

        expect(gameViewDto).toBeDefined();
        expect(gameViewDto).not.toBeNull();
        expect(gameViewDto.id).toBe(game.id.toString());
        expect(gameViewDto.status).toBe(GameStatus.Active);
        expect(gameViewDto.pairCreatedDate).toBe(game.createdAt.toISOString());
        expect(gameViewDto.startGameDate).toBe(game.startGameDate!.toISOString());
        expect(gameViewDto.finishGameDate).toBeNull();

        expect(gameViewDto.firstPlayerProgress).toBeDefined();
        expect(gameViewDto.firstPlayerProgress).not.toBeNull();
        expect(gameViewDto.firstPlayerProgress.player.id).toBe(firstUserId.toString());
        expect(gameViewDto.firstPlayerProgress.player.login).toBe(firstUserLogin);
        expect(gameViewDto.firstPlayerProgress.score).toBe(0);
        expect(gameViewDto.firstPlayerProgress.answers).toEqual([]);

        expect(gameViewDto.secondPlayerProgress).toBeDefined();
        expect(gameViewDto.secondPlayerProgress).not.toBeNull();
        expect(gameViewDto.secondPlayerProgress!.player.id).toBe(secondUserId.toString());
        expect(gameViewDto.secondPlayerProgress!.player.login).toBe(secondUserLogin);
        expect(gameViewDto.secondPlayerProgress!.score).toBe(0);
        expect(gameViewDto.secondPlayerProgress!.answers).toEqual([]);

        expect(gameViewDto.questions).toHaveLength(REQUIRED_QUESTIONS_COUNT);
        for (let i = 0; i < REQUIRED_QUESTIONS_COUNT; i++) {
          expect(gameViewDto.questions![i].id).toBe(questions[i].publicId);
          expect(gameViewDto.questions![i].body).toBe(questions[i].body);
        }
      });

      it('должен успешно вернуть текущую игру с ответами первого игрока (Host). Игра в статусе Active', async () => {
        const { id: firstUserId }: User = await createTestUser({
          login: 'firstUser',
          email: 'firstUser@example.com',
        });
        const { id: secondUserId }: User = await createTestUser({
          login: 'secondUser',
          email: 'secondUser@example.com',
        });
        const { game, players } = await createActiveGameWithPlayers(firstUserId, secondUserId);
        const questions: Question[] =
          await createMultiplePublishedQuestions(REQUIRED_QUESTIONS_COUNT);
        const gameQuestions: GameQuestion[] = await linkQuestionsToGame(game.id, questions);

        const answers: Answer[] = [];
        for (let i = 0; i < REQUIRED_QUESTIONS_COUNT; i++) {
          const answer: Answer = await createTestAnswer({
            answerBody: questions[i].correctAnswers[0],
            status: AnswerStatus.Correct,
            playerId: players[0].id,
            gameQuestionId: gameQuestions[i].id,
            gameId: game.id,
          });

          answers.push(answer);
        }

        for (let i = 0; i < REQUIRED_QUESTIONS_COUNT; i++) {
          players[0].addScore();
        }
        await playerRepo.save(players[0]);

        const gameViewDto: GameViewDto = await queryHandler.execute(
          new GetCurrentGameQuery(firstUserId),
        );

        expect(gameViewDto.status).toBe(GameStatus.Active);

        expect(gameViewDto.firstPlayerProgress.score).toBe(REQUIRED_QUESTIONS_COUNT);
        expect(gameViewDto.firstPlayerProgress.answers).toHaveLength(REQUIRED_QUESTIONS_COUNT);

        for (let i = 0; i < answers.length; i++) {
          expect(gameViewDto.firstPlayerProgress.answers[i].questionId).toBe(questions[i].publicId);
          expect(gameViewDto.firstPlayerProgress.answers[i].answerStatus).toBe(
            AnswerStatus.Correct,
          );
          expect(gameViewDto.firstPlayerProgress.answers[i].addedAt).toBe(
            answers[i].addedAt.toISOString(),
          );
        }

        expect(gameViewDto.secondPlayerProgress!.score).toBe(0);
        expect(gameViewDto.secondPlayerProgress!.answers).toEqual([]);
      });

      it('должен успешно вернуть текущую игру с ответами второго игрока (Player). Игра в статусе Active', async () => {
        const { id: firstUserId }: User = await createTestUser({
          login: 'firstUser',
          email: 'firstUser@example.com',
        });
        const { id: secondUserId }: User = await createTestUser({
          login: 'secondUser',
          email: 'secondUser@example.com',
        });
        const { game, players } = await createActiveGameWithPlayers(firstUserId, secondUserId);
        const questions: Question[] =
          await createMultiplePublishedQuestions(REQUIRED_QUESTIONS_COUNT);
        const gameQuestions: GameQuestion[] = await linkQuestionsToGame(game.id, questions);

        const answers: Answer[] = [];
        for (let i = 0; i < REQUIRED_QUESTIONS_COUNT; i++) {
          const answer: Answer = await createTestAnswer({
            answerBody: questions[i].correctAnswers[0],
            status: AnswerStatus.Correct,
            playerId: players[1].id,
            gameQuestionId: gameQuestions[i].id,
            gameId: game.id,
          });
          answers.push(answer);
        }

        for (let i = 0; i < REQUIRED_QUESTIONS_COUNT; i++) {
          players[1].addScore();
        }
        await playerRepo.save(players[1]);

        const gameViewDto: GameViewDto = await queryHandler.execute(
          new GetCurrentGameQuery(secondUserId),
        );

        expect(gameViewDto.status).toBe(GameStatus.Active);

        expect(gameViewDto.firstPlayerProgress.score).toBe(0);
        expect(gameViewDto.firstPlayerProgress.answers).toEqual([]);

        expect(gameViewDto.secondPlayerProgress!.score).toBe(REQUIRED_QUESTIONS_COUNT);
        expect(gameViewDto.secondPlayerProgress!.answers).toHaveLength(REQUIRED_QUESTIONS_COUNT);

        for (let i = 0; i < answers.length; i++) {
          expect(gameViewDto.secondPlayerProgress!.answers[i].questionId).toBe(
            questions[i].publicId,
          );
          expect(gameViewDto.secondPlayerProgress!.answers[i].answerStatus).toBe(
            AnswerStatus.Correct,
          );
          expect(gameViewDto.secondPlayerProgress!.answers[i].addedAt).toBe(
            answers[i].addedAt.toISOString(),
          );
        }
      });

      it('должен успешно вернуть текущую игру с ответами обоих игроков. Игра в статусе Active', async () => {
        const { id: firstUserId }: User = await createTestUser({
          login: 'firstUser',
          email: 'firstUser@example.com',
        });
        const { id: secondUserId }: User = await createTestUser({
          login: 'secondUser',
          email: 'secondUser@example.com',
        });
        const { game, players } = await createActiveGameWithPlayers(firstUserId, secondUserId);
        const questions: Question[] =
          await createMultiplePublishedQuestions(REQUIRED_QUESTIONS_COUNT);
        const gameQuestions: GameQuestion[] = await linkQuestionsToGame(game.id, questions);

        const answersCount: number = REQUIRED_QUESTIONS_COUNT - 2;
        const answers_player1: Answer[] = [];
        const answers_player2: Answer[] = [];

        for (let i = 0; i < answersCount; i++) {
          const answer_p1: Answer = await createTestAnswer({
            answerBody: questions[i].correctAnswers[0],
            status: AnswerStatus.Correct,
            playerId: players[0].id,
            gameQuestionId: gameQuestions[i].id,
            gameId: game.id,
          });

          const answer_p2: Answer = await createTestAnswer({
            answerBody: questions[i].correctAnswers[0],
            status: AnswerStatus.Correct,
            playerId: players[1].id,
            gameQuestionId: gameQuestions[i].id,
            gameId: game.id,
          });

          answers_player1.push(answer_p1);
          answers_player2.push(answer_p2);
        }

        for (let i = 0; i < answersCount; i++) {
          players[0].addScore();
          players[1].addScore();
        }
        await playerRepo.save(players[0]);
        await playerRepo.save(players[1]);

        const gameViewDto: GameViewDto = await queryHandler.execute(
          new GetCurrentGameQuery(firstUserId),
        );

        expect(gameViewDto.status).toBe(GameStatus.Active);

        expect(gameViewDto.firstPlayerProgress.score).toBe(answersCount);
        expect(gameViewDto.firstPlayerProgress.answers).toHaveLength(answersCount);

        for (let i = 0; i < answers_player1.length; i++) {
          expect(gameViewDto.firstPlayerProgress.answers[i].questionId).toBe(questions[i].publicId);
          expect(gameViewDto.firstPlayerProgress.answers[i].answerStatus).toBe(
            AnswerStatus.Correct,
          );
        }

        expect(gameViewDto.secondPlayerProgress!.score).toBe(answersCount);
        expect(gameViewDto.secondPlayerProgress!.answers).toHaveLength(answersCount);

        for (let i = 0; i < answers_player2.length; i++) {
          expect(gameViewDto.secondPlayerProgress!.answers[i].questionId).toBe(
            questions[i].publicId,
          );
          expect(gameViewDto.secondPlayerProgress!.answers[i].answerStatus).toBe(
            AnswerStatus.Correct,
          );
        }

        expect(gameViewDto.questions).toHaveLength(REQUIRED_QUESTIONS_COUNT);
      });

      it('должен успешно вернуть текущую игру с комбинацией правильных и неправильных ответов. Игра в статусе Active', async () => {
        const { id: firstUserId }: User = await createTestUser({
          login: 'firstUser',
          email: 'firstUser@example.com',
        });
        const { id: secondUserId }: User = await createTestUser({
          login: 'secondUser',
          email: 'secondUser@example.com',
        });
        const { game, players } = await createActiveGameWithPlayers(firstUserId, secondUserId);
        const questions: Question[] =
          await createMultiplePublishedQuestions(REQUIRED_QUESTIONS_COUNT);
        const gameQuestions: GameQuestion[] = await linkQuestionsToGame(game.id, questions);

        const correctAnswersCount: number = 3;
        for (let i = 0; i < correctAnswersCount; i++) {
          await createTestAnswer({
            answerBody: questions[i].correctAnswers[0],
            status: AnswerStatus.Correct,
            playerId: players[0].id,
            gameQuestionId: gameQuestions[i].id,
            gameId: game.id,
          });
        }
        for (let i = correctAnswersCount; i < REQUIRED_QUESTIONS_COUNT; i++) {
          await createTestAnswer({
            answerBody: questions[i].correctAnswers[0],
            status: AnswerStatus.Incorrect,
            playerId: players[0].id,
            gameQuestionId: gameQuestions[i].id,
            gameId: game.id,
          });
        }

        for (let i = 0; i < correctAnswersCount; i++) {
          players[0].addScore();
        }
        await playerRepo.save(players[0]);

        const gameViewDto: GameViewDto = await queryHandler.execute(
          new GetCurrentGameQuery(firstUserId),
        );

        expect(gameViewDto.firstPlayerProgress.score).toBe(correctAnswersCount);
        expect(gameViewDto.firstPlayerProgress.answers).toHaveLength(REQUIRED_QUESTIONS_COUNT);

        for (let i = 0; i < correctAnswersCount; i++) {
          expect(gameViewDto.firstPlayerProgress.answers[i].answerStatus).toBe(
            AnswerStatus.Correct,
          );
        }
        for (let i = correctAnswersCount; i < REQUIRED_QUESTIONS_COUNT; i++) {
          expect(gameViewDto.firstPlayerProgress.answers[i].answerStatus).toBe(
            AnswerStatus.Incorrect,
          );
        }
      });
    });

    describe('Граничные случаи статуса игры', () => {
      it('должен выбросить DomainException NotFound если пользователь находится только в игре со статусом Finished', async () => {
        const { id: firstUserId }: User = await createTestUser({
          login: 'firstUser',
          email: 'firstUser@example.com',
        });
        const { id: secondUserId }: User = await createTestUser({
          login: 'secondUser',
          email: 'secondUser@example.com',
        });
        const { game } = await createFinishedGameWithPlayers(firstUserId, secondUserId);
        const questions: Question[] =
          await createMultiplePublishedQuestions(REQUIRED_QUESTIONS_COUNT);
        await linkQuestionsToGame(game.id, questions);

        try {
          await queryHandler.execute(new GetCurrentGameQuery(firstUserId));
          fail('Ожидали DomainException');
        } catch (error) {
          expect(error).toBeInstanceOf(DomainException);
          expect((error as DomainException).code).toBe(DomainExceptionCode.NotFound);
          expect((error as DomainException).message).toBe(
            `User with id ${firstUserId} is not participating in active pair`,
          );
        }
      });

      it('должен вернуть игру в статусе Pending если у пользователя есть и Pending и Finished игры', async () => {
        const { id: firstUserId }: User = await createTestUser({
          login: 'firstUser',
          email: 'firstUser@example.com',
        });
        const { id: secondUserId }: User = await createTestUser({
          login: 'secondUser',
          email: 'secondUser@example.com',
        });

        await createFinishedGameWithPlayers(firstUserId, secondUserId);

        const { game: pendingGame } = await createPendingGameWithOnePlayer(firstUserId);

        const gameViewDto: GameViewDto = await queryHandler.execute(
          new GetCurrentGameQuery(firstUserId),
        );

        expect(gameViewDto.id).toBe(pendingGame.id.toString());
        expect(gameViewDto.status).toBe(GameStatus.Pending);
      });
    });
  });

  describe('Негативные сценарии', () => {
    describe('Пользователь не участвует ни в какой игре', () => {
      it('должен выбросить DomainException NotFound если пользователь не участвует ни в Pending ни в Active игре', async () => {
        const { id: userId }: User = await createTestUser();

        try {
          await queryHandler.execute(new GetCurrentGameQuery(userId));
          fail('Ожидали DomainException');
        } catch (error) {
          expect(error).toBeInstanceOf(DomainException);
          expect((error as DomainException).code).toBe(DomainExceptionCode.NotFound);
          expect((error as DomainException).message).toBe(
            `User with id ${userId} is not participating in active pair`,
          );
        }
      });

      it('должен выбросить DomainException Forbidden если пользователь существует но не участвует в играх (есть другие игроки)', async () => {
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

        await createActiveGameWithPlayers(firstUserId, secondUserId);
        await createPendingGameWithOnePlayer(thirdUserId);

        try {
          await queryHandler.execute(new GetCurrentGameQuery(userIdUnderTest));
          fail('Ожидали DomainException');
        } catch (error) {
          expect(error).toBeInstanceOf(DomainException);
          expect((error as DomainException).code).toBe(DomainExceptionCode.NotFound);
          expect((error as DomainException).message).toBe(
            `User with id ${userIdUnderTest} is not participating in active pair`,
          );
        }
      });
    });
  });
});
