import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, Repository } from 'typeorm';
import { RecordAnswerCommand, RecordAnswerUseCase } from './record-answer.usecase';
import { UsersFactory } from '../../../../user-accounts/users/application/factories/users.factory';
import { GamesRepository } from '../../infrastructure/games.repository';
import { PlayersRepository } from '../../infrastructure/players.repository';
import { QuestionsRepository } from '../../../admin/infrastructure/questions-repository';
import { User } from '../../../../user-accounts/users/domain/entities/user.entity';
import { Game, GameStatus } from '../../domain/entities/game.entity';
import { GameRole, Player } from '../../domain/entities/player.entity';
import { Question } from '../../../admin/domain/entities/question.entity';
import { GameQuestion } from '../../domain/entities/game-question.entity';
import { configModule } from '../../../../../dynamic-config.module';
import { DatabaseModule } from '../../../../database/database.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getRelatedEntities } from '../../../../../core/utils/get-related-entities.utility';
import { CryptoService } from '../../../../user-accounts/users/application/services/crypto.service';
import { DateService } from '../../../../user-accounts/users/application/services/date.service';
import { UserInputDto } from '../../../../user-accounts/users/api/input-dto/user.input-dto';
import { CreateUserDto } from '../../../../user-accounts/users/dto/create-user.dto';
import { QuestionInputDto } from '../../../admin/api/input-dto/question.input-dto';
import { GameQuestionCreateDto } from '../../domain/dto/game-question.create-dto';
import { Answer, AnswerStatus } from '../../domain/entities/answer.entity';
import { AnswerViewDto } from '../../api/view-dto/answer.view-dto';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';
import { REQUIRED_QUESTIONS_COUNT } from '../../domain/constants/game.constants';
import { GameFinishSchedulerService } from '../../domain/services/game-finish-scheduler.service';
import { TransactionHelper } from '../../../../database/trasaction.helper';

describe('RecordAnswerUseCase (Integration)', () => {
  let module: TestingModule;
  let dataSource: DataSource;

  let gameFinishSchedulerService: GameFinishSchedulerService;
  // let coreConfig: CoreConfig;

  let useCase: RecordAnswerUseCase;
  let usersFactory: UsersFactory;

  let userRepo: Repository<User>;
  let gameRepo: Repository<Game>;
  let playerRepo: Repository<Player>;
  let questionRepo: Repository<Question>;
  let gameQuestionRepo: Repository<GameQuestion>;
  let answerRepo: Repository<Answer>;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [configModule, DatabaseModule, TypeOrmModule.forFeature(getRelatedEntities(Game))],
      providers: [
        RecordAnswerUseCase,

        GamesRepository,
        PlayersRepository,
        QuestionsRepository,

        UsersFactory,
        CryptoService,
        DateService,

        GameFinishSchedulerService,

        TransactionHelper,
      ],
    }).compile();

    dataSource = module.get<DataSource>(DataSource);
    usersFactory = module.get<UsersFactory>(UsersFactory);
    useCase = module.get<RecordAnswerUseCase>(RecordAnswerUseCase);

    gameFinishSchedulerService = module.get(GameFinishSchedulerService);

    gameRepo = dataSource.getRepository<Game>(Game);
    playerRepo = dataSource.getRepository<Player>(Player);
    questionRepo = dataSource.getRepository<Question>(Question);
    gameQuestionRepo = dataSource.getRepository<GameQuestion>(GameQuestion);
    userRepo = dataSource.getRepository<User>(User);
    answerRepo = dataSource.getRepository(Answer);
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

  const createPendingGameWithOnePlayer = async (playerId: number) => {
    const game: Game = Game.create();
    const createdGame: Game = await gameRepo.save(game);

    const player: Player = Player.create(playerId, createdGame.id);
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

  describe('Позитивные сценарии с правильными ответами', () => {
    it('должен успешно сохранить правильный ответ первого игрока на первый вопрос и начислить 1 очко (в списке 2 правильных ответа. Тестируется первый правильный ответ)', async () => {
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

      const gameQuestionUnderTest: GameQuestion = gameQuestions[0];
      const questionUnderTest: Question = questions[0];
      const answerUnderTest: string = questionUnderTest.correctAnswers[0]; //первый правильный ответ

      // ----------------------------------------------------------------

      const result: AnswerViewDto = await useCase.execute(
        new RecordAnswerCommand(firstUserId, answerUnderTest),
      );

      expect(result.questionId).toBe(questionUnderTest.publicId);
      expect(result.answerStatus).toBe(AnswerStatus.Correct);
      expect(result.addedAt).toBeDefined();
      expect(typeof result.addedAt).toBe('string');

      const respondingPlayer: Player | null = await playerRepo.findOne({
        where: { id: players[0].id },
      });

      const savedAnswer: Answer | null = await answerRepo.findOne({
        where: { playerId: respondingPlayer!.id, gameQuestionId: gameQuestionUnderTest.id },
      });

      expect(savedAnswer).toBeDefined();
      expect(savedAnswer).not.toBeNull();
      expect(savedAnswer!.answerBody).toBe(answerUnderTest);
      expect(savedAnswer!.status).toBe(AnswerStatus.Correct);
      expect(savedAnswer!.addedAt).toBeInstanceOf(Date);
      expect(savedAnswer!.playerId).toBe(respondingPlayer!.id);
      expect(savedAnswer!.gameId).toBe(game.id);

      expect(respondingPlayer!.score).toBe(1);
    });

    it('должен успешно сохранить правильный ответ первого игрока на первый вопрос и начислить 1 очко (в списке 2 правильных ответа. Тестируется второй правильный ответ)', async () => {
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

      const gameQuestionUnderTest: GameQuestion = gameQuestions[0];
      const questionUnderTest: Question = questions[0];
      const answerUnderTest: string = questionUnderTest.correctAnswers[1]; //второй правильный ответ

      const result: AnswerViewDto = await useCase.execute(
        new RecordAnswerCommand(firstUserId, answerUnderTest),
      );

      expect(result.questionId).toBe(questionUnderTest.publicId);
      expect(result.answerStatus).toBe(AnswerStatus.Correct);
      expect(result.addedAt).toBeDefined();
      expect(typeof result.addedAt).toBe('string');

      const respondingPlayer: Player | null = await playerRepo.findOne({
        where: { id: players[0].id },
      });

      const savedAnswer: Answer | null = await answerRepo.findOne({
        where: { playerId: respondingPlayer!.id, gameQuestionId: gameQuestionUnderTest.id },
      });

      expect(savedAnswer).toBeDefined();
      expect(savedAnswer).not.toBeNull();
      expect(savedAnswer!.answerBody).toBe(answerUnderTest);
      expect(savedAnswer!.status).toBe(AnswerStatus.Correct);
      expect(savedAnswer!.addedAt).toBeInstanceOf(Date);
      expect(savedAnswer!.playerId).toBe(respondingPlayer!.id);
      expect(savedAnswer!.gameId).toBe(game.id);

      expect(respondingPlayer!.score).toBe(1);
    });

    it('должен успешно сохранить несколько правильных ответов первого игрока на и начислить необходимое кол-во очков', async () => {
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

      for (let i = 0; i < questions.length - 1; i++) {
        const gameQuestionUnderTest: GameQuestion = gameQuestions[i];
        const questionUnderTest: Question = questions[i];
        const answerUnderTest: string = questionUnderTest.correctAnswers[0];

        const result: AnswerViewDto = await useCase.execute(
          new RecordAnswerCommand(firstUserId, answerUnderTest),
        );

        expect(result.questionId).toBe(questionUnderTest.publicId);
        expect(result.answerStatus).toBe(AnswerStatus.Correct);
        expect(result.addedAt).toBeDefined();
        expect(typeof result.addedAt).toBe('string');

        const respondingPlayer: Player | null = await playerRepo.findOne({
          where: { id: players[0].id },
        });

        const savedAnswer: Answer | null = await answerRepo.findOne({
          where: { playerId: respondingPlayer!.id, gameQuestionId: gameQuestionUnderTest.id },
        });

        expect(savedAnswer).toBeDefined();
        expect(savedAnswer).not.toBeNull();
        expect(savedAnswer!.answerBody).toBe(answerUnderTest);
        expect(savedAnswer!.status).toBe(AnswerStatus.Correct);
        expect(savedAnswer!.addedAt).toBeInstanceOf(Date);
        expect(savedAnswer!.playerId).toBe(respondingPlayer!.id);
        expect(savedAnswer!.gameId).toBe(game.id);
        expect(respondingPlayer!.score).toBe(i + 1);
      }
    });

    it('должен успешно сохранить последовательные правильные ответы первого и второго игрока, начислять необходимое кол-во очков и возвращать корректный результат ответа', async () => {
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

      for (let i = 0; i < questions.length - 1; i++) {
        const gameQuestionUnderTest: GameQuestion = gameQuestions[i];
        const questionUnderTest: Question = questions[i];
        const answerUnderTest_player1: string = questionUnderTest.correctAnswers[0];
        const answerUnderTest_player2: string = questionUnderTest.correctAnswers[1];

        const result_player1: AnswerViewDto = await useCase.execute(
          new RecordAnswerCommand(firstUserId, answerUnderTest_player1),
        );

        const result_player2: AnswerViewDto = await useCase.execute(
          new RecordAnswerCommand(secondUserId, answerUnderTest_player2),
        );

        expect(result_player1.questionId).toBe(questionUnderTest.publicId);
        expect(result_player1.answerStatus).toBe(AnswerStatus.Correct);
        expect(result_player1.addedAt).toBeDefined();
        expect(typeof result_player1.addedAt).toBe('string');

        expect(result_player2.questionId).toBe(questionUnderTest.publicId);
        expect(result_player2.answerStatus).toBe(AnswerStatus.Correct);
        expect(result_player2.addedAt).toBeDefined();
        expect(typeof result_player2.addedAt).toBe('string');

        const responding_player1: Player | null = await playerRepo.findOne({
          where: { id: players[0].id },
        });
        const responding_player2: Player | null = await playerRepo.findOne({
          where: { id: players[1].id },
        });

        const savedAnswer_player1: Answer | null = await answerRepo.findOne({
          where: { playerId: responding_player1!.id, gameQuestionId: gameQuestionUnderTest.id },
        });
        const savedAnswer_player2: Answer | null = await answerRepo.findOne({
          where: { playerId: responding_player2!.id, gameQuestionId: gameQuestionUnderTest.id },
        });

        expect(savedAnswer_player1).toBeDefined();
        expect(savedAnswer_player1).not.toBeNull();
        expect(savedAnswer_player1!.answerBody).toBe(answerUnderTest_player1);
        expect(savedAnswer_player1!.status).toBe(AnswerStatus.Correct);
        expect(savedAnswer_player1!.addedAt).toBeInstanceOf(Date);
        expect(savedAnswer_player1!.playerId).toBe(responding_player1!.id);
        expect(savedAnswer_player1!.gameId).toBe(game.id);
        expect(responding_player1!.score).toBe(i + 1);

        expect(savedAnswer_player2).toBeDefined();
        expect(savedAnswer_player2).not.toBeNull();
        expect(savedAnswer_player2!.answerBody).toBe(answerUnderTest_player2);
        expect(savedAnswer_player2!.status).toBe(AnswerStatus.Correct);
        expect(savedAnswer_player2!.addedAt).toBeInstanceOf(Date);
        expect(savedAnswer_player2!.playerId).toBe(responding_player2!.id);
        expect(savedAnswer_player2!.gameId).toBe(game.id);
        expect(responding_player2!.score).toBe(i + 1);
      }
    });

    it('должен начислить 2 очка за правильный ответ на последний вопрос если противник уже закончил отвечать', async () => {
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
      await linkQuestionsToGame(game.id, questions);

      for (let i = 0; i < questions.length - 1; i++) {
        await useCase.execute(new RecordAnswerCommand(firstUserId, questions[i].correctAnswers[0]));
        await useCase.execute(
          new RecordAnswerCommand(secondUserId, questions[i].correctAnswers[0]),
        );
      }

      const [firstPlayerBeforeAnsweringLastQuestion, secondPlayerBeforeAnsweringLastQuestion] =
        await Promise.all([
          playerRepo.findOne({
            where: { id: players[0].id },
          }),
          playerRepo.findOne({
            where: { id: players[1].id },
          }),
        ]);

      expect(firstPlayerBeforeAnsweringLastQuestion).toBeDefined();
      expect(firstPlayerBeforeAnsweringLastQuestion).not.toBeNull();
      expect(firstPlayerBeforeAnsweringLastQuestion!.score).toBe(4);

      expect(secondPlayerBeforeAnsweringLastQuestion).toBeDefined();
      expect(secondPlayerBeforeAnsweringLastQuestion).not.toBeNull();
      expect(secondPlayerBeforeAnsweringLastQuestion!.score).toBe(4);

      await useCase.execute(
        new RecordAnswerCommand(firstUserId, questions[questions.length - 1].correctAnswers[0]),
      );
      await useCase.execute(
        new RecordAnswerCommand(secondUserId, questions[questions.length - 1].correctAnswers[0]),
      );

      const [firstPlayerAfterAnsweringLastQuestion, secondPlayerAfterAnsweringLastQuestion] =
        await Promise.all([
          playerRepo.findOne({
            where: { id: players[0].id },
          }),
          playerRepo.findOne({
            where: { id: players[1].id },
          }),
        ]);

      expect(firstPlayerAfterAnsweringLastQuestion).toBeDefined();
      expect(firstPlayerAfterAnsweringLastQuestion).not.toBeNull();
      expect(firstPlayerAfterAnsweringLastQuestion!.score).toBe(6);

      expect(secondPlayerAfterAnsweringLastQuestion).toBeDefined();
      expect(secondPlayerAfterAnsweringLastQuestion).not.toBeNull();
      expect(secondPlayerAfterAnsweringLastQuestion!.score).toBe(5);
    });

    it('должен начислить 1 очко за правильный ответ на 5-й вопрос если противник еще не закончил отвечать', async () => {
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
      await linkQuestionsToGame(game.id, questions);

      for (let i = 0; i < questions.length - 1; i++) {
        await useCase.execute(new RecordAnswerCommand(firstUserId, questions[i].correctAnswers[0]));
        await useCase.execute(
          new RecordAnswerCommand(secondUserId, questions[i].correctAnswers[0]),
        );
      }

      const [firstPlayerBeforeAnsweringLastQuestion, secondPlayerBeforeAnsweringLastQuestion] =
        await Promise.all([
          playerRepo.findOne({
            where: { id: players[0].id },
          }),
          playerRepo.findOne({
            where: { id: players[1].id },
          }),
        ]);

      expect(firstPlayerBeforeAnsweringLastQuestion).toBeDefined();
      expect(firstPlayerBeforeAnsweringLastQuestion).not.toBeNull();
      expect(firstPlayerBeforeAnsweringLastQuestion!.score).toBe(4);

      expect(secondPlayerBeforeAnsweringLastQuestion).toBeDefined();
      expect(secondPlayerBeforeAnsweringLastQuestion).not.toBeNull();
      expect(secondPlayerBeforeAnsweringLastQuestion!.score).toBe(4);

      await useCase.execute(
        new RecordAnswerCommand(firstUserId, questions[questions.length - 1].correctAnswers[0]),
      );

      const [firstPlayerAfterAnsweringLastQuestion, secondPlayerAfterAnsweringLastQuestion] =
        await Promise.all([
          playerRepo.findOne({
            where: { id: players[0].id },
          }),
          playerRepo.findOne({
            where: { id: players[1].id },
          }),
        ]);

      expect(firstPlayerAfterAnsweringLastQuestion).toBeDefined();
      expect(firstPlayerAfterAnsweringLastQuestion).not.toBeNull();
      expect(firstPlayerAfterAnsweringLastQuestion!.score).toBe(5);

      expect(secondPlayerAfterAnsweringLastQuestion).toBeDefined();
      expect(secondPlayerAfterAnsweringLastQuestion).not.toBeNull();
      expect(secondPlayerAfterAnsweringLastQuestion!.score).toBe(4);
    });

    it('должен завершить игру со статусом Finished после ответа на последний вопрос последним игроком', async () => {
      const { id: firstUserId }: User = await createTestUser({
        login: 'firstUser',
        email: 'firstUser@example.com',
      });
      const { id: secondUserId }: User = await createTestUser({
        login: 'secondUser',
        email: 'secondUser@example.com',
      });
      const { game } = await createActiveGameWithPlayers(firstUserId, secondUserId);
      const questions: Question[] =
        await createMultiplePublishedQuestions(REQUIRED_QUESTIONS_COUNT);
      await linkQuestionsToGame(game.id, questions);

      for (let i = 0; i < questions.length; i++) {
        await useCase.execute(
          new RecordAnswerCommand(secondUserId, questions[i].correctAnswers[0]),
        );

        if (i < questions.length - 1) {
          await useCase.execute(
            new RecordAnswerCommand(firstUserId, questions[i].correctAnswers[0]),
          );
        }
      }

      const gameBeforeAnsweringLastQuestion: Game | null = await gameRepo.findOne({
        where: { id: game.id },
      });

      expect(gameBeforeAnsweringLastQuestion).toBeDefined();
      expect(gameBeforeAnsweringLastQuestion).not.toBeNull();
      expect(gameBeforeAnsweringLastQuestion!.status).toBe(GameStatus.Active);

      await useCase.execute(
        new RecordAnswerCommand(firstUserId, questions[questions.length - 1].correctAnswers[0]),
      );

      const gameAfterAnsweringLastQuestion: Game | null = await gameRepo.findOne({
        where: { id: game.id },
      });

      expect(gameAfterAnsweringLastQuestion).toBeDefined();
      expect(gameAfterAnsweringLastQuestion).not.toBeNull();
      expect(gameAfterAnsweringLastQuestion!.status).toBe(GameStatus.Finished);
    });
  });

  describe('Позитивные сценарии с неправильными ответами', () => {
    it('должен сохранить неправильный ответ первого игрока на первый вопрос без начисления очков и вернуть статус Incorrect', async () => {
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

      const gameQuestionUnderTest: GameQuestion = gameQuestions[0];
      const questionUnderTest: Question = questions[0];
      const answerUnderTest: string = 'Incorrect answer';

      const result: AnswerViewDto = await useCase.execute(
        new RecordAnswerCommand(firstUserId, answerUnderTest),
      );

      expect(result.questionId).toBe(questionUnderTest.publicId);
      expect(result.answerStatus).toBe(AnswerStatus.Incorrect);
      expect(result.addedAt).toBeDefined();
      expect(typeof result.addedAt).toBe('string');

      const respondingPlayer: Player | null = await playerRepo.findOne({
        where: { id: players[0].id },
      });

      const savedAnswer: Answer | null = await answerRepo.findOne({
        where: { playerId: respondingPlayer!.id, gameQuestionId: gameQuestionUnderTest.id },
      });

      expect(savedAnswer).toBeDefined();
      expect(savedAnswer).not.toBeNull();
      expect(savedAnswer!.answerBody).toBe(answerUnderTest);
      expect(savedAnswer!.status).toBe(AnswerStatus.Incorrect);
      expect(savedAnswer!.addedAt).toBeInstanceOf(Date);
      expect(savedAnswer!.playerId).toBe(respondingPlayer!.id);
      expect(savedAnswer!.gameId).toBe(game.id);

      expect(respondingPlayer!.score).toBe(0);
    });

    it('должен успешно сохранить последовательные неправильные ответы первого и второго игрока, не начислять  очки и возвращать корректный результат ответа', async () => {
      const { id: firstUserId }: User = await createTestUser({
        login: 'firstUser',
        email: 'firstUser@example.com',
      });
      const { id: secondUserId }: User = await createTestUser({
        login: 'secondUser',
        email: 'secondUser@example.com',
      });
      const { game, players } = await createActiveGameWithPlayers(firstUserId, secondUserId);
      const questions: Question[] = await createMultiplePublishedQuestions(5);
      const gameQuestions: GameQuestion[] = await linkQuestionsToGame(game.id, questions);

      for (let i = 0; i < questions.length - 1; i++) {
        const gameQuestionUnderTest: GameQuestion = gameQuestions[i];
        const questionUnderTest: Question = questions[i];
        const answerUnderTest_player1: string = 'Incorrect answer player 1';
        const answerUnderTest_player2: string = 'Incorrect answer player 2';

        const result_player1: AnswerViewDto = await useCase.execute(
          new RecordAnswerCommand(firstUserId, answerUnderTest_player1),
        );

        const result_player2: AnswerViewDto = await useCase.execute(
          new RecordAnswerCommand(secondUserId, answerUnderTest_player2),
        );

        expect(result_player1.questionId).toBe(questionUnderTest.publicId);
        expect(result_player1.answerStatus).toBe(AnswerStatus.Incorrect);
        expect(result_player1.addedAt).toBeDefined();
        expect(typeof result_player1.addedAt).toBe('string');

        expect(result_player2.questionId).toBe(questionUnderTest.publicId);
        expect(result_player2.answerStatus).toBe(AnswerStatus.Incorrect);
        expect(result_player2.addedAt).toBeDefined();
        expect(typeof result_player2.addedAt).toBe('string');

        const [responding_player1, responding_player2] = await Promise.all([
          playerRepo.findOne({
            where: { id: players[0].id },
          }),
          playerRepo.findOne({
            where: { id: players[1].id },
          }),
        ]);

        const [savedAnswer_player1, savedAnswer_player2] = await Promise.all([
          answerRepo.findOne({
            where: { playerId: responding_player1!.id, gameQuestionId: gameQuestionUnderTest.id },
          }),
          answerRepo.findOne({
            where: { playerId: responding_player2!.id, gameQuestionId: gameQuestionUnderTest.id },
          }),
        ]);

        expect(savedAnswer_player1).toBeDefined();
        expect(savedAnswer_player1).not.toBeNull();
        expect(savedAnswer_player1!.answerBody).toBe(answerUnderTest_player1);
        expect(savedAnswer_player1!.status).toBe(AnswerStatus.Incorrect);
        expect(savedAnswer_player1!.addedAt).toBeInstanceOf(Date);
        expect(savedAnswer_player1!.playerId).toBe(responding_player1!.id);
        expect(savedAnswer_player1!.gameId).toBe(game.id);
        expect(responding_player1!.score).toBe(0);

        expect(savedAnswer_player2).toBeDefined();
        expect(savedAnswer_player2).not.toBeNull();
        expect(savedAnswer_player2!.answerBody).toBe(answerUnderTest_player2);
        expect(savedAnswer_player2!.status).toBe(AnswerStatus.Incorrect);
        expect(savedAnswer_player2!.addedAt).toBeInstanceOf(Date);
        expect(savedAnswer_player2!.playerId).toBe(responding_player2!.id);
        expect(savedAnswer_player2!.gameId).toBe(game.id);
        expect(responding_player2!.score).toBe(0);
      }
    });

    it('должен начислить 1 очко за неправильный ответ на последний вопрос если у игрока уже есть очки и он первым ответил на последний вопрос', async () => {
      const { id: firstUserId }: User = await createTestUser({
        login: 'firstUser',
        email: 'firstUser@example.com',
      });
      const { id: secondUserId }: User = await createTestUser({
        login: 'secondUser',
        email: 'secondUser@example.com',
      });
      const { game, players } = await createActiveGameWithPlayers(firstUserId, secondUserId);
      const questions: Question[] = await createMultiplePublishedQuestions(5);
      await linkQuestionsToGame(game.id, questions);

      for (let i = 0; i < questions.length - 1; i++) {
        await useCase.execute(new RecordAnswerCommand(firstUserId, questions[i].correctAnswers[0]));
        await useCase.execute(
          new RecordAnswerCommand(secondUserId, questions[i].correctAnswers[0]),
        );
      }

      const [firstPlayerBeforeAnsweringLastQuestion, secondPlayerBeforeAnsweringLastQuestion] =
        await Promise.all([
          playerRepo.findOne({
            where: { id: players[0].id },
          }),
          playerRepo.findOne({
            where: { id: players[1].id },
          }),
        ]);

      expect(firstPlayerBeforeAnsweringLastQuestion).toBeDefined();
      expect(firstPlayerBeforeAnsweringLastQuestion).not.toBeNull();
      expect(firstPlayerBeforeAnsweringLastQuestion!.score).toBe(4);

      expect(secondPlayerBeforeAnsweringLastQuestion).toBeDefined();
      expect(secondPlayerBeforeAnsweringLastQuestion).not.toBeNull();
      expect(secondPlayerBeforeAnsweringLastQuestion!.score).toBe(4);

      await useCase.execute(new RecordAnswerCommand(firstUserId, 'incorrect answer'));
      await useCase.execute(new RecordAnswerCommand(secondUserId, 'incorrect answer'));

      const [firstPlayerAfterAnsweringLastQuestion, secondPlayerAfterAnsweringLastQuestion] =
        await Promise.all([
          playerRepo.findOne({
            where: { id: players[0].id },
          }),
          playerRepo.findOne({
            where: { id: players[1].id },
          }),
        ]);

      expect(firstPlayerAfterAnsweringLastQuestion).toBeDefined();
      expect(firstPlayerAfterAnsweringLastQuestion).not.toBeNull();
      expect(firstPlayerAfterAnsweringLastQuestion!.score).toBe(5);

      expect(secondPlayerAfterAnsweringLastQuestion).toBeDefined();
      expect(secondPlayerAfterAnsweringLastQuestion).not.toBeNull();
      expect(secondPlayerAfterAnsweringLastQuestion!.score).toBe(4);
    });
  });

  describe('Негативные сценарии', () => {
    it('должен выбросить Forbidden если пользователь не в активной игре', async () => {
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

      const answerUnderTest_1: string = questionsForActiveGame[0].correctAnswers[0];
      const answerUnderTest_2: string = questionsForPendingGame[0].correctAnswers[0];

      try {
        await useCase.execute(new RecordAnswerCommand(userIdUnderTest, 'answer'));
        fail('Ожидали DomainException');
      } catch (error) {
        expect(error).toBeInstanceOf(DomainException);
        expect((error as DomainException).code).toBe(DomainExceptionCode.Forbidden);
        expect((error as DomainException).message).toBe(
          `The user with the ID ${userIdUnderTest} is not in an active pair`,
        );
      }

      try {
        await useCase.execute(new RecordAnswerCommand(userIdUnderTest, answerUnderTest_1));
        fail('Ожидали DomainException');
      } catch (error) {
        expect(error).toBeInstanceOf(DomainException);
        expect((error as DomainException).code).toBe(DomainExceptionCode.Forbidden);
        expect((error as DomainException).message).toBe(
          `The user with the ID ${userIdUnderTest} is not in an active pair`,
        );
      }

      try {
        await useCase.execute(new RecordAnswerCommand(userIdUnderTest, answerUnderTest_2));
        fail('Ожидали DomainException');
      } catch (error) {
        expect(error).toBeInstanceOf(DomainException);
        expect((error as DomainException).code).toBe(DomainExceptionCode.Forbidden);
        expect((error as DomainException).message).toBe(
          `The user with the ID ${userIdUnderTest} is not in an active pair`,
        );
      }
    });

    it('должен выбросить Forbidden если игрок уже ответил на все 5 вопросов', async () => {
      const { id: firstUserId }: User = await createTestUser({
        login: 'firstUser',
        email: 'firstUser@example.com',
      });
      const { id: secondUserId }: User = await createTestUser({
        login: 'secondUser',
        email: 'secondUser@example.com',
      });
      const { game, players } = await createActiveGameWithPlayers(firstUserId, secondUserId);
      const questions: Question[] = await createMultiplePublishedQuestions(5);
      await linkQuestionsToGame(game.id, questions);

      for (let i = 0; i < questions.length; i++) {
        await useCase.execute(new RecordAnswerCommand(firstUserId, questions[i].correctAnswers[0]));
      }

      for (let i = 0; i < questions.length; i++) {
        try {
          await useCase.execute(
            new RecordAnswerCommand(firstUserId, questions[i].correctAnswers[0]),
          );
          fail('Ожидали DomainException');
        } catch (error) {
          expect(error).toBeInstanceOf(DomainException);
          expect((error as DomainException).code).toBe(DomainExceptionCode.Forbidden);
          expect((error as DomainException).message).toBe(
            `The player ${players[0].id} has already answered all the questions`,
          );
        }
      }
    });
  });

  describe('Проверка timestamps', () => {
    it('должен корректно устанавливать addedAt при сохранении ответа', async () => {
      const { id: firstUserId }: User = await createTestUser({
        login: 'firstUser',
        email: 'firstUser@example.com',
      });
      const { id: secondUserId }: User = await createTestUser({
        login: 'secondUser',
        email: 'secondUser@example.com',
      });
      const { game } = await createActiveGameWithPlayers(firstUserId, secondUserId);
      const questions: Question[] = await createMultiplePublishedQuestions(5);
      await linkQuestionsToGame(game.id, questions);

      const before = new Date();
      const result: AnswerViewDto = await useCase.execute(
        new RecordAnswerCommand(firstUserId, questions[0].correctAnswers[0]),
      );
      const after = new Date();

      const addedAtDate = new Date(result.addedAt);
      expect(addedAtDate.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(addedAtDate.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('должен устанавливать finishGameDate при завершении игры', async () => {
      const { id: firstUserId }: User = await createTestUser({
        login: 'firstUser',
        email: 'firstUser@example.com',
      });
      const { id: secondUserId }: User = await createTestUser({
        login: 'secondUser',
        email: 'secondUser@example.com',
      });
      const { game } = await createActiveGameWithPlayers(firstUserId, secondUserId);
      const questions: Question[] = await createMultiplePublishedQuestions(5);
      await linkQuestionsToGame(game.id, questions);

      for (let i = 0; i < questions.length - 1; i++) {
        await useCase.execute(new RecordAnswerCommand(firstUserId, questions[i].correctAnswers[0]));
        await useCase.execute(
          new RecordAnswerCommand(secondUserId, questions[i].correctAnswers[0]),
        );
      }

      const before = new Date();
      await useCase.execute(
        new RecordAnswerCommand(firstUserId, questions[questions.length - 1].correctAnswers[0]),
      );
      await useCase.execute(
        new RecordAnswerCommand(secondUserId, questions[questions.length - 1].correctAnswers[0]),
      );
      const after = new Date();

      const finishedGame: Game | null = await gameRepo.findOne({ where: { id: game.id } });
      expect(finishedGame!.finishGameDate).toBeInstanceOf(Date);

      expect(finishedGame!.finishGameDate!.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(finishedGame!.finishGameDate!.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('Логика с отложенным завершением игры', () => {
    describe('Первый игрок отвечает на все вопросы первым', () => {
      it('должен запланировать завершение игры когда первый игрок отвечает на последний вопрос', async () => {
        const user1: User = await createTestUser({
          login: 'user1',
          email: 'user1r@example.com',
        });
        const user2: User = await createTestUser({
          login: 'user2',
          email: 'user2@example.com',
        });
        const { game } = await createActiveGameWithPlayers(user1.id, user2.id);
        const questions: Question[] =
          await createMultiplePublishedQuestions(REQUIRED_QUESTIONS_COUNT);
        await linkQuestionsToGame(game.id, questions);

        // user1 отвечает на первые 4 вопроса
        for (let i = 0; i < REQUIRED_QUESTIONS_COUNT - 1; i++) {
          await useCase.execute(new RecordAnswerCommand(user1.id, questions[i].correctAnswers[0]));
        }

        // user2 отвечает на 2 вопроса (НЕ на все)
        await useCase.execute(new RecordAnswerCommand(user2.id, questions[0].correctAnswers[0]));
        await useCase.execute(new RecordAnswerCommand(user2.id, questions[1].correctAnswers[0]));

        // Проверяем что в очереди пока нет задач
        const scheduledGamesBefore = gameFinishSchedulerService.getScheduledGames();
        expect(scheduledGamesBefore.size).toBe(0);

        // user1 отвечает на ПОСЛЕДНИЙ вопрос (5-й)
        await useCase.execute(
          new RecordAnswerCommand(
            user1.id,
            questions[REQUIRED_QUESTIONS_COUNT - 1].correctAnswers[0],
          ),
        );

        // проверяем что задача запланирована в очереди
        const scheduledGamesAfter = gameFinishSchedulerService.getScheduledGames();
        expect(scheduledGamesAfter.size).toBe(1);

        const timeout = scheduledGamesAfter.get(game.id);

        expect(timeout).toBeDefined();
        expect(timeout).not.toBeNull();
        expect(timeout!['_idleTimeout']).toBe(10000);
        expect(timeout!['_destroyed']).toBe(false);

        // Проверяем что игра всё ещё активна
        const updatedGame: Game | null = await gameRepo.findOne({ where: { id: game.id } });
        expect(updatedGame!.status).toBe(GameStatus.Active);
      });

      it('должен отменить запланированную задачу и завершить игру когда второй игрок отвечает на последний вопрос вовремя', async () => {
        const user1: User = await createTestUser({
          login: 'user1',
          email: 'user1@example.com',
        });
        const user2: User = await createTestUser({
          login: 'user2',
          email: 'user2@example.com',
        });
        const { game } = await createActiveGameWithPlayers(user1.id, user2.id);
        const questions: Question[] =
          await createMultiplePublishedQuestions(REQUIRED_QUESTIONS_COUNT);
        await linkQuestionsToGame(game.id, questions);

        // user1 отвечает на все 5 вопросов
        for (let i = 0; i < REQUIRED_QUESTIONS_COUNT; i++) {
          await useCase.execute(new RecordAnswerCommand(user1.id, questions[i].correctAnswers[0]));
        }

        // Проверяем что задача запланирована
        const scheduledGames_1 = gameFinishSchedulerService.getScheduledGames();
        expect(scheduledGames_1.size).toBe(1);

        // user2 отвечает на первые 4 вопроса
        for (let i = 0; i < REQUIRED_QUESTIONS_COUNT - 1; i++) {
          await useCase.execute(new RecordAnswerCommand(user2.id, questions[i].correctAnswers[0]));
        }

        // user2 отвечает на последний вопрос (игра должна завершиться)
        await useCase.execute(
          new RecordAnswerCommand(
            user2.id,
            questions[REQUIRED_QUESTIONS_COUNT - 1].correctAnswers[0],
          ),
        );

        // проверяем что задача отменена (удалена из очереди)
        const scheduledGames_2 = gameFinishSchedulerService.getScheduledGames();
        expect(scheduledGames_2.size).toBe(0); // Задача должна быть удалена

        // Проверяем что игра завершена
        const finishedGame: Game | null = await gameRepo.findOne({ where: { id: game.id } });
        expect(finishedGame!.status).toBe(GameStatus.Finished);
        expect(finishedGame!.finishGameDate).not.toBeNull();
      });

      it('должен начислить бонус первому игроку при отмене отложенной задачи (оба ответили на все вопросы)', async () => {
        const user1: User = await createTestUser({
          login: 'user1',
          email: 'user1@example.com',
        });
        const user2: User = await createTestUser({
          login: 'user2',
          email: 'user2@example.com',
        });
        const { game, players } = await createActiveGameWithPlayers(user1.id, user2.id);
        const questions: Question[] =
          await createMultiplePublishedQuestions(REQUIRED_QUESTIONS_COUNT);
        await linkQuestionsToGame(game.id, questions);

        // user1 отвечает на все 5 вопросов (все правильные)
        for (let i = 0; i < REQUIRED_QUESTIONS_COUNT; i++) {
          await useCase.execute(new RecordAnswerCommand(user1.id, questions[i].correctAnswers[0]));
        }

        // Задержка чтобы время ответов отличалось
        await new Promise((resolve) => setTimeout(resolve, 100));

        // user2 отвечает на все 5 вопросов (все правильные)
        for (let i = 0; i < REQUIRED_QUESTIONS_COUNT; i++) {
          await useCase.execute(new RecordAnswerCommand(user2.id, questions[i].correctAnswers[0]));
        }

        // Assert: проверяем что user1 получил бонус
        const player1Updated: Player | null = await playerRepo.findOne({
          where: { id: players[0].id },
        });
        const player2Updated: Player | null = await playerRepo.findOne({
          where: { id: players[1].id },
        });

        // user1 должен иметь 6 очков (5 правильных + 1 бонус за скорость)
        expect(player1Updated!.score).toBe(6);

        // user2 должен иметь 5 очков (5 правильных, без бонуса)
        expect(player2Updated!.score).toBe(5);

        // Проверяем что игра завершена
        const finishedGame: Game | null = await gameRepo.findOne({ where: { id: game.id } });
        expect(finishedGame!.status).toBe(GameStatus.Finished);
      });

      it('НЕ должен начислить бонус первому игроку если его score = 0', async () => {
        const user1: User = await createTestUser({
          login: 'user1',
          email: 'user1@example.com',
        });
        const user2: User = await createTestUser({
          login: 'user2',
          email: 'user2@example.com',
        });
        const { game, players } = await createActiveGameWithPlayers(user1.id, user2.id);
        const questions: Question[] =
          await createMultiplePublishedQuestions(REQUIRED_QUESTIONS_COUNT);
        await linkQuestionsToGame(game.id, questions);

        // user1 отвечает на все 5 вопросов (все НЕПРАВИЛЬНЫЕ, score = 0)
        for (let i = 0; i < REQUIRED_QUESTIONS_COUNT; i++) {
          await useCase.execute(new RecordAnswerCommand(user1.id, 'Wrong answer'));
        }

        // user2 отвечает на все 5 вопросов (все правильные)
        for (let i = 0; i < REQUIRED_QUESTIONS_COUNT; i++) {
          await useCase.execute(new RecordAnswerCommand(user2.id, questions[i].correctAnswers[0]));
        }

        // проверяем что user1 НЕ получил бонус
        const player1Updated: Player | null = await playerRepo.findOne({
          where: { id: players[0].id },
        });
        const player2Updated: Player | null = await playerRepo.findOne({
          where: { id: players[1].id },
        });

        // user1 должен иметь 0 очков (без бонуса, т.к. score был 0)
        expect(player1Updated!.score).toBe(0);

        // user2 должен иметь 5 очков (5 правильных)
        expect(player2Updated!.score).toBe(5);

        // Проверяем что игра завершена
        const finishedGame: Game | null = await gameRepo.findOne({ where: { id: game.id } });
        expect(finishedGame!.status).toBe(GameStatus.Finished);
      });
    });

    describe('GameFinishProcessor (обработка отложенных задач)', () => {
      // it('должен завершить игру и проставить Incorrect ответы второму игроку по истечении таймаута', async () => {
      //   // создаём ситуацию где user1 ответил на все, user2 - только на 2 вопроса
      //   const user1: User = await createTestUser({
      //     login: 'user1',
      //     email: 'user1@example.com',
      //   });
      //   const user2: User = await createTestUser({
      //     login: 'user2',
      //     email: 'user2@example.com',
      //   });
      //   const { game, players } = await createActiveGameWithPlayers(user1.id, user2.id);
      //   const questions: Question[] =
      //     await createMultiplePublishedQuestions(REQUIRED_QUESTIONS_COUNT);
      //   await linkQuestionsToGame(game.id, questions);
      //
      //   // user1 отвечает на все 5 вопросов (все правильные)
      //   for (let i = 0; i < REQUIRED_QUESTIONS_COUNT; i++) {
      //     await useCase.execute(new RecordAnswerCommand(user1.id, questions[i].correctAnswers[0]));
      //   }
      //
      //   // user2 отвечает только на 2 вопроса
      //   await useCase.execute(new RecordAnswerCommand(user2.id, questions[0].correctAnswers[0]));
      //   await useCase.execute(new RecordAnswerCommand(user2.id, questions[1].correctAnswers[0]));
      //
      //   // проверяем что задача запланирована в очереди
      //   const scheduledGamesAfter = gameFinishSchedulerService.getScheduledGames();
      //   expect(scheduledGamesAfter.size).toBe(1);
      //
      //   const timeout = scheduledGamesAfter.get(game.id);
      //   expect(timeout).toBeDefined();
      //   expect(timeout).not.toBeNull();
      //   expect(timeout!['_idleTimeout']).toBe(10000);
      //
      //   // проверяем что игра завершена
      //   const finishedGame: Game | null = await gameRepo.findOne({ where: { id: game.id } });
      //   expect(finishedGame!.status).toBe(GameStatus.Finished);
      //   expect(finishedGame!.finishGameDate).not.toBeNull();
      //
      //   // Проверяем что для user2 созданы 3 неправильных ответа (на вопросы 3, 4, 5)
      //   const allAnswers: Answer[] = await answerRepo.find({
      //     where: { gameId: game.id },
      //     order: { addedAt: 'ASC' },
      //   });
      //
      //   // Всего должно быть 10 ответов: 5 от user1 + 2 правильных от user2 + 3 неправильных от user2
      //   expect(allAnswers).toHaveLength(10);
      //
      //   // Фильтруем ответы user2
      //   const player2Answers: Answer[] = allAnswers.filter((a) => a.playerId === players[1].id);
      //   expect(player2Answers).toHaveLength(5);
      //
      //   // Первые 2 ответа - правильные (отвечал сам)
      //   expect(player2Answers[0].status).toBe(AnswerStatus.Correct);
      //   expect(player2Answers[1].status).toBe(AnswerStatus.Correct);
      //
      //   // Последние 3 ответа - неправильные (проставлены процессором)
      //   expect(player2Answers[2].status).toBe(AnswerStatus.Incorrect);
      //   expect(player2Answers[2].answerBody).toBe('');
      //   expect(player2Answers[3].status).toBe(AnswerStatus.Incorrect);
      //   expect(player2Answers[3].answerBody).toBe('');
      //   expect(player2Answers[4].status).toBe(AnswerStatus.Incorrect);
      //   expect(player2Answers[4].answerBody).toBe('');
      // });
      // it('должен начислить бонус первому игроку при завершении по таймауту (если score > 0)', async () => {
      //   // Arrange
      //   const user1: User = await createTestUser({
      //     login: 'timeout_bonus_first',
      //     email: 'timeout_bonus_first@example.com',
      //   });
      //   const user2: User = await createTestUser({
      //     login: 'timeout_bonus_second',
      //     email: 'timeout_bonus_second@example.com',
      //   });
      //   const { game, players } = await createActiveGameWithPlayers(user1.id, user2.id);
      //   const questions: Question[] =
      //     await createMultiplePublishedQuestions(REQUIRED_QUESTIONS_COUNT);
      //   await linkQuestionsToGame(game.id, questions);
      //
      //   // user1 отвечает на все 5 вопросов (все правильные, score = 5)
      //   for (let i = 0; i < REQUIRED_QUESTIONS_COUNT; i++) {
      //     await useCase.execute(
      //       new RecordAnswerCommand(user1.id, questions[i].correctAnswers[0]),
      //     );
      //   }
      //
      //   // user2 отвечает только на 1 вопрос
      //   await useCase.execute(new RecordAnswerCommand(user2.id, questions[0].correctAnswers[0]));
      //
      //   const jobData: GameFinishJobDto = {
      //     gameId: game.id,
      //     userId: user1.id,
      //     firstFinishedPlayerId: players[0].id,
      //   };
      //   const job = await gameFinishQueue.add('finish-game', jobData, {
      //     jobId: `game-finish-${game.id}`,
      //   });
      //
      //   // Act: выполняем процессор
      //   await gameFinishProcessor.process(job);
      //
      //   // Assert: проверяем что user1 получил бонус
      //   const player1Updated: Player | null = await playerRepo.findOne({
      //     where: { id: players[0].id },
      //   });
      //
      //   // user1 должен иметь 6 очков (5 правильных + 1 бонус)
      //   expect(player1Updated!.score).toBe(6);
      // });
      //
      // it('НЕ должен начислить бонус первому игроку при завершении по таймауту если score = 0', async () => {
      //   // Arrange
      //   const user1: User = await createTestUser({
      //     login: 'timeout_no_bonus',
      //     email: 'timeout_no_bonus@example.com',
      //   });
      //   const user2: User = await createTestUser({
      //     login: 'timeout_no_bonus_second',
      //     email: 'timeout_no_bonus_second@example.com',
      //   });
      //   const { game, players } = await createActiveGameWithPlayers(user1.id, user2.id);
      //   const questions: Question[] =
      //     await createMultiplePublishedQuestions(REQUIRED_QUESTIONS_COUNT);
      //   await linkQuestionsToGame(game.id, questions);
      //
      //   // user1 отвечает на все 5 вопросов (все НЕПРАВИЛЬНЫЕ, score = 0)
      //   for (let i = 0; i < REQUIRED_QUESTIONS_COUNT; i++) {
      //     await useCase.execute(new RecordAnswerCommand(user1.id, 'Wrong answer'));
      //   }
      //
      //   // user2 отвечает только на 1 вопрос
      //   await useCase.execute(new RecordAnswerCommand(user2.id, questions[0].correctAnswers[0]));
      //
      //   const jobData: GameFinishJobDto = {
      //     gameId: game.id,
      //     userId: user1.id,
      //     firstFinishedPlayerId: players[0].id,
      //   };
      //   const job = await gameFinishQueue.add('finish-game', jobData, {
      //     jobId: `game-finish-${game.id}`,
      //   });
      //
      //   // Act: выполняем процессор
      //   await gameFinishProcessor.process(job);
      //
      //   // Assert: проверяем что user1 НЕ получил бонус
      //   const player1Updated: Player | null = await playerRepo.findOne({
      //     where: { id: players[0].id },
      //   });
      //
      //   // user1 должен иметь 0 очков (без бонуса)
      //   expect(player1Updated!.score).toBe(0);
      // });
      //
      // it('НЕ должен завершить игру если она уже Finished (второй игрок успел ответить)', async () => {
      //   // Arrange: создаём уже завершённую игру
      //   const user1: User = await createTestUser({
      //     login: 'already_finished_first',
      //     email: 'already_finished_first@example.com',
      //   });
      //   const user2: User = await createTestUser({
      //     login: 'already_finished_second',
      //     email: 'already_finished_second@example.com',
      //   });
      //   const { game, players } = await createFinishedGameWithPlayers(user1.id, user2.id);
      //
      //   const jobData: GameFinishJobDto = {
      //     gameId: game.id,
      //     userId: user1.id,
      //     firstFinishedPlayerId: players[0].id,
      //   };
      //   const job = await gameFinishQueue.add('finish-game', jobData, {
      //     jobId: `game-finish-${game.id}`,
      //   });
      //
      //   // Act: выполняем процессор
      //   await gameFinishProcessor.process(job);
      //
      //   // Assert: проверяем что ничего не сломалось, игра осталась Finished
      //   const finishedGame: Game | null = await gameRepo.findOne({ where: { id: game.id } });
      //   expect(finishedGame!.status).toBe(GameStatus.Finished);
      //
      //   // Проверяем что не создавались лишние ответы
      //   const answers: Answer[] = await answerRepo.find({ where: { gameId: game.id } });
      //   // Количество ответов не должно измениться
      // });
      //
      // it('должен корректно обработать ситуацию когда игра не найдена', async () => {
      //   // Arrange: создаём job для несуществующей игры
      //   const nonExistentGameId = 99999;
      //   const jobData: GameFinishJobDto = {
      //     gameId: nonExistentGameId,
      //     userId: 1,
      //     firstFinishedPlayerId: 1,
      //   };
      //   const job = await gameFinishQueue.add('finish-game', jobData, {
      //     jobId: `game-finish-${nonExistentGameId}`,
      //   });
      //
      //   // Act & Assert: процессор должен логировать warning и не падать
      //   await expect(gameFinishProcessor.process(job)).resolves.not.toThrow();
      // });
      //
      // it('НЕ должен создавать Incorrect ответы если второй игрок уже ответил на все вопросы', async () => {
      //   // Arrange: создаём ситуацию где оба ответили на все вопросы
      //   const user1: User = await createTestUser({
      //     login: 'both_answered_first',
      //     email: 'both_answered_first@example.com',
      //   });
      //   const user2: User = await createTestUser({
      //     login: 'both_answered_second',
      //     email: 'both_answered_second@example.com',
      //   });
      //   const { game, players } = await createActiveGameWithPlayers(user1.id, user2.id);
      //   const questions: Question[] =
      //     await createMultiplePublishedQuestions(REQUIRED_QUESTIONS_COUNT);
      //   await linkQuestionsToGame(game.id, questions);
      //
      //   // Оба отвечают на все 5 вопросов
      //   for (let i = 0; i < REQUIRED_QUESTIONS_COUNT; i++) {
      //     await useCase.execute(
      //       new RecordAnswerCommand(user1.id, questions[i].correctAnswers[0]),
      //     );
      //     await useCase.execute(
      //       new RecordAnswerCommand(user2.id, questions[i].correctAnswers[0]),
      //     );
      //   }
      //
      //   // Игра должна быть завершена
      //   const finishedGame: Game | null = await gameRepo.findOne({ where: { id: game.id } });
      //   expect(finishedGame!.status).toBe(GameStatus.Finished);
      //
      //   // Создаём job (который должен был быть отменён, но проверим что процессор защищён)
      //   const jobData: GameFinishJobDto = {
      //     gameId: game.id,
      //     userId: user1.id,
      //     firstFinishedPlayerId: players[0].id,
      //   };
      //   const job = await gameFinishQueue.add('finish-game', jobData, {
      //     jobId: `game-finish-${game.id}`,
      //   });
      //
      //   const answersCountBefore: number = await answerRepo.count({ where: { gameId: game.id } });
      //
      //   // Act: выполняем процессор
      //   await gameFinishProcessor.process(job);
      //
      //   // Assert: количество ответов не должно измениться (не создались лишние Incorrect)
      //   const answersCountAfter: number = await answerRepo.count({ where: { gameId: game.id } });
      //   expect(answersCountAfter).toBe(answersCountBefore);
      // });
    });

    // describe('Граничные случаи с очередью', () => {
    //   it('должен корректно обработать множественные вызовы scheduleGameFinish для одной игры', async () => {
    //     // Arrange
    //     const user1: User = await createTestUser({
    //       login: 'multiple_schedule_first',
    //       email: 'multiple_schedule_first@example.com',
    //     });
    //     const user2: User = await createTestUser({
    //       login: 'multiple_schedule_second',
    //       email: 'multiple_schedule_second@example.com',
    //     });
    //     const { game, players } = await createActiveGameWithPlayers(user1.id, user2.id);
    //     const questions: Question[] =
    //       await createMultiplePublishedQuestions(REQUIRED_QUESTIONS_COUNT);
    //     await linkQuestionsToGame(game.id, questions);
    //
    //     // user1 отвечает на все 5 вопросов
    //     for (let i = 0; i < REQUIRED_QUESTIONS_COUNT; i++) {
    //       await useCase.execute(
    //         new RecordAnswerCommand(user1.id, questions[i].correctAnswers[0]),
    //       );
    //     }
    //
    //     // Проверяем что в очереди только одна задача
    //     const jobsBefore = await gameFinishQueue.getJobs(['delayed']);
    //     expect(jobsBefore).toHaveLength(1);
    //
    //     // Попробуем запланировать ещё раз (не должно создаться дубликатов)
    //     const jobId = `game-finish-${game.id}`;
    //     await gameFinishQueue.add(
    //       'finish-game',
    //       {
    //         gameId: game.id,
    //         userId: user1.id,
    //         firstFinishedPlayerId: players[0].id,
    //       },
    //       { jobId, delay: coreConfig.gameFinishTimeoutMs },
    //     );
    //
    //     // Assert: в очереди всё ещё одна задача (с тем же jobId)
    //     const jobsAfter = await gameFinishQueue.getJobs(['delayed']);
    //     expect(jobsAfter).toHaveLength(1);
    //     expect(jobsAfter[0].id).toBe(jobId);
    //   });
    // });
  });
});
