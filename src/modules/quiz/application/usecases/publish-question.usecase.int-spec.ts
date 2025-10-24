import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, Repository } from 'typeorm';
import { PublishQuestionCommand, PublishQuestionUseCase } from './publish-question.usecase';
import { Question, QuestionStatus } from '../../domain/entities/question.entity';
import { QuestionsRepository } from '../../infrastructure/questions-repository';
import { DatabaseModule } from '../../../database/database.module';
import { CoreModule } from '../../../../core/core.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getRelatedEntities } from '../../../../core/utils/get-related-entities.utility';
import { configModule } from '../../../../dynamic-config.module';
import { DomainException } from '../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../core/exceptions/domain-exception-codes';
import { ValidationException } from '../../../../core/exceptions/validation-exception';
import { QuestionInputDto } from '../../api/input-dto/question.input-dto';

describe('PublishQuestionUseCase (Integration)', () => {
  let module: TestingModule;
  let useCase: PublishQuestionUseCase;
  let dataSource: DataSource;
  let questionRepo: Repository<Question>;
  let questionsRepository: QuestionsRepository;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        configModule,
        DatabaseModule,
        CoreModule,
        TypeOrmModule.forFeature(getRelatedEntities(Question)),
      ],
      providers: [PublishQuestionUseCase, QuestionsRepository],
    }).compile();

    useCase = module.get<PublishQuestionUseCase>(PublishQuestionUseCase);
    dataSource = module.get<DataSource>(DataSource);
    questionsRepository = module.get<QuestionsRepository>(QuestionsRepository);
    questionRepo = dataSource.getRepository<Question>(Question);
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE TABLE questions RESTART IDENTITY CASCADE');
  });

  afterAll(async () => {
    await dataSource.destroy();
    await module.close();
  });

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

  describe('успешная публикация вопроса', () => {
    it('должен опубликовать вопрос со статусом notPublished и правильными ответами', async () => {
      const { id, status }: Question = await createTestQuestion();

      expect(status).toBe(QuestionStatus.NotPublished);

      await useCase.execute(new PublishQuestionCommand(id));

      const publishedQuestion: Question | null = await questionRepo.findOneBy({ id });

      expect(publishedQuestion).toBeDefined();
      expect(publishedQuestion!.status).toBe(QuestionStatus.Published);
    });

    it('должен опубликовать вопрос с одним правильным ответом', async () => {
      const { id }: Question = await createTestQuestion({
        body: 'What is 2+2?',
        correctAnswers: ['4'],
      });

      await useCase.execute(new PublishQuestionCommand(id));

      const publishedQuestion: Question | null = await questionRepo.findOneBy({ id });
      expect(publishedQuestion!.status).toBe(QuestionStatus.Published);
    });

    it('должен опубликовать вопрос с множественными правильными ответами', async () => {
      const { id }: Question = await createTestQuestion({
        body: 'Which are programming languages?',
        correctAnswers: ['JavaScript', 'Python', 'Java', 'TypeScript'],
      });

      await useCase.execute(new PublishQuestionCommand(id));

      const publishedQuestion: Question | null = await questionRepo.findOneBy({ id });
      expect(publishedQuestion!.status).toBe(QuestionStatus.Published);
    });

    it('должен обновить только статус публикации не затрагивая другие поля', async () => {
      const question: Question = await createTestQuestion();
      const originalBody: string = question.body;
      const originalAnswers: string[] = [...question.correctAnswers];
      const originalCreatedAt: Date = question.createdAt;
      const originalUpdatedAt: Date = question.updatedAt;

      await useCase.execute(new PublishQuestionCommand(question.id));

      const publishedQuestion: Question | null = await questionRepo.findOneBy({ id: question.id });

      expect(publishedQuestion!.body).toBe(originalBody);
      expect(publishedQuestion!.correctAnswers).toEqual(originalAnswers);
      expect(publishedQuestion!.createdAt).toEqual(originalCreatedAt);
      expect(publishedQuestion!.updatedAt.getTime()).toBeGreaterThanOrEqual(
        originalUpdatedAt.getTime(),
      );
      expect(publishedQuestion!.status).toBe(QuestionStatus.Published);
    });
  });

  describe('обработка ошибок домена', () => {
    it('должен выбросить DomainException при попытке опубликовать несуществующий вопрос', async () => {
      const nonExistentId = 99999;

      await expect(useCase.execute(new PublishQuestionCommand(nonExistentId))).rejects.toThrow(
        DomainException,
      );
    });

    it('должен выбросить DomainException с правильным кодом NotFound для несуществующего вопроса', async () => {
      const nonExistentId = 88888;

      try {
        await useCase.execute(new PublishQuestionCommand(nonExistentId));
        fail('Ожидали DomainException');
      } catch (error) {
        expect(error).toBeInstanceOf(DomainException);
        expect((error as DomainException).code).toBe(DomainExceptionCode.NotFound);
        expect((error as DomainException).message).toContain(
          `The question with ID (${nonExistentId}) does not exist`,
        );
      }
    });

    it('должен выбросить DomainException при попытке опубликовать уже опубликованный вопрос', async () => {
      const { id }: Question = await createTestQuestion();

      await useCase.execute(new PublishQuestionCommand(id));

      await expect(useCase.execute(new PublishQuestionCommand(id))).rejects.toThrow(
        DomainException,
      );
    });

    it('должен выбросить DomainException с правильным кодом BadRequest для уже опубликованного вопроса', async () => {
      const { id }: Question = await createTestQuestion();

      await useCase.execute(new PublishQuestionCommand(id));

      try {
        await useCase.execute(new PublishQuestionCommand(id));
        fail('Ожидали DomainException');
      } catch (error) {
        expect(error).toBeInstanceOf(DomainException);
        expect((error as DomainException).code).toBe(DomainExceptionCode.BadRequest);
        expect((error as DomainException).message).toContain(
          `The question with ID (${id}) already published`,
        );
      }
    });

    it('должен выбросить ValidationException при попытке опубликовать вопрос без правильных ответов', async () => {
      const { id }: Question = await createTestQuestion({
        body: 'Question without correct answers',
        correctAnswers: [],
      });

      await expect(useCase.execute(new PublishQuestionCommand(id))).rejects.toThrow(
        ValidationException,
      );
    });

    it('должен выбросить ValidationException с правильным сообщением для вопроса без правильных ответов', async () => {
      const { id }: Question = await createTestQuestion({
        correctAnswers: [],
      });

      try {
        await useCase.execute(new PublishQuestionCommand(id));
        fail('Ожидали ValidationException');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationException);
        expect((error as ValidationException).extensions).toEqual([
          {
            message: 'Cannot publish question without correct answers',
            field: 'correctAnswers',
          },
        ]);
      }
    });

    it('не должен изменить статус вопроса при ValidationException', async () => {
      const { id }: Question = await createTestQuestion({ correctAnswers: [] });

      await expect(useCase.execute(new PublishQuestionCommand(id))).rejects.toThrow(
        ValidationException,
      );

      const unchangedQuestion: Question | null = await questionRepo.findOneBy({ id });
      expect(unchangedQuestion!.status).toBe(QuestionStatus.NotPublished);
    });

    it('не должен изменить статус при попытке опубликовать уже опубликованный вопрос', async () => {
      const { id }: Question = await createTestQuestion();

      await useCase.execute(new PublishQuestionCommand(id));

      const firstPublishedQuestion: Question | null = await questionRepo.findOneBy({
        id,
      });
      const firstUpdatedAt: Date = firstPublishedQuestion!.updatedAt;

      await new Promise((resolve) => setTimeout(resolve, 10));

      await expect(useCase.execute(new PublishQuestionCommand(id))).rejects.toThrow(
        DomainException,
      );

      const secondPublishedQuestion: Question | null = await questionRepo.findOneBy({
        id,
      });
      expect(secondPublishedQuestion!.status).toBe(QuestionStatus.Published);
      expect(secondPublishedQuestion!.updatedAt).toEqual(firstUpdatedAt);
    });
  });

  describe('граничные случаи', () => {
    it('должен корректно обрабатывать ID равный нулю', async () => {
      await expect(useCase.execute(new PublishQuestionCommand(0))).rejects.toThrow(DomainException);
    });

    it('должен корректно обрабатывать отрицательные ID', async () => {
      await expect(useCase.execute(new PublishQuestionCommand(-1))).rejects.toThrow(
        DomainException,
      );
    });

    it('должен корректно обрабатывать очень большие ID', async () => {
      await expect(
        useCase.execute(new PublishQuestionCommand(Number.MAX_SAFE_INTEGER)),
      ).rejects.toThrow();
    });

    it('должен корректно обрабатывать дробные ID', async () => {
      await expect(useCase.execute(new PublishQuestionCommand(123.456))).rejects.toThrow();
    });

    it('должен публиковать вопрос с одним ответом минимальной длины', async () => {
      const dto: QuestionInputDto = {
        body: 'Short answer',
        correctAnswers: ['X'],
      };
      const { id }: Question = await createTestQuestion(dto);

      await useCase.execute(new PublishQuestionCommand(id));
      const after: Question | null = await questionRepo.findOneBy({ id });
      expect(after?.status).toBe(QuestionStatus.Published);
    });

    it('должен публиковать вопрос с ответом максимальной длины', async () => {
      const answer: string = 'A'.repeat(100);
      const dto: QuestionInputDto = {
        body: 'Long answer',
        correctAnswers: [answer],
      };
      const { id }: Question = await createTestQuestion(dto);

      await useCase.execute(new PublishQuestionCommand(id));
      const after: Question | null = await questionRepo.findOneBy({ id });
      expect(after?.correctAnswers[0].length).toBe(100);
      expect(after?.status).toBe(QuestionStatus.Published);
    });
  });

  describe('конкурентность и производительность', () => {
    it('должен корректно обрабатывать публикацию разных вопросов одновременно', async () => {
      const questions: Question[] = await Promise.all([
        createTestQuestion({ body: 'Question 1' }),
        createTestQuestion({ body: 'Question 2' }),
        createTestQuestion({ body: 'Question 3' }),
      ]);

      const publishPromises = questions.map((question) =>
        useCase.execute(new PublishQuestionCommand(question.id)),
      );

      await Promise.all(publishPromises);

      const publishedQuestions: (Question | null)[] = await Promise.all(
        questions.map((question) => questionRepo.findOneBy({ id: question.id })),
      );

      publishedQuestions.forEach((question) => {
        expect(question!.status).toBe(QuestionStatus.Published);
      });
    });

    it('должен корректно обрабатывать множественные последовательные операции на одном вопросе', async () => {
      const { id }: Question = await createTestQuestion();

      await useCase.execute(new PublishQuestionCommand(id));

      for (let i = 0; i < 3; i++) {
        await expect(useCase.execute(new PublishQuestionCommand(id))).rejects.toThrow(
          DomainException,
        );
      }

      const finalQuestion: Question | null = await questionRepo.findOneBy({ id });
      expect(finalQuestion!.status).toBe(QuestionStatus.Published);
    });
  });

  describe('интеграция с repository', () => {
    it('должен правильно вызывать методы repository в нужном порядке', async () => {
      const { id }: Question = await createTestQuestion();

      const getByIdSpy = jest.spyOn(questionsRepository, 'getById');
      const saveSpy = jest.spyOn(questionsRepository, 'save');

      await useCase.execute(new PublishQuestionCommand(id));

      expect(getByIdSpy).toHaveBeenCalledWith(id);
      expect(getByIdSpy).toHaveBeenCalledTimes(1);
      expect(saveSpy).toHaveBeenCalledTimes(1);

      const getByIdCall: number = getByIdSpy.mock.invocationCallOrder[0];
      const saveCall: number = saveSpy.mock.invocationCallOrder[0];
      expect(getByIdCall).toBeLessThan(saveCall);

      const saveCallArgs: Question = saveSpy.mock.calls[0][0];
      expect(saveCallArgs).toBeInstanceOf(Question);
      expect(saveCallArgs.status).toBe(QuestionStatus.Published);

      getByIdSpy.mockRestore();
      saveSpy.mockRestore();
    });

    it('не должен вызывать save если вопрос не найден', async () => {
      const nonExistentId = 99999;

      const saveSpy = jest.spyOn(questionsRepository, 'save');

      await expect(useCase.execute(new PublishQuestionCommand(nonExistentId))).rejects.toThrow(
        DomainException,
      );

      expect(saveSpy).not.toHaveBeenCalled();

      saveSpy.mockRestore();
    });

    it('не должен вызывать save если вопрос уже опубликован', async () => {
      const { id }: Question = await createTestQuestion();

      await useCase.execute(new PublishQuestionCommand(id));

      const saveSpy = jest.spyOn(questionsRepository, 'save');

      await expect(useCase.execute(new PublishQuestionCommand(id))).rejects.toThrow(
        DomainException,
      );

      expect(saveSpy).not.toHaveBeenCalled();

      saveSpy.mockRestore();
    });

    it('не должен вызывать save если нет правильных ответов', async () => {
      const { id }: Question = await createTestQuestion({ correctAnswers: [] });

      const saveSpy = jest.spyOn(questionsRepository, 'save');

      await expect(useCase.execute(new PublishQuestionCommand(id))).rejects.toThrow(
        ValidationException,
      );

      expect(saveSpy).not.toHaveBeenCalled();

      saveSpy.mockRestore();
    });
  });

  describe('валидация business-правил', () => {
    it('должен требовать минимум один правильный ответ', async () => {
      const { id }: Question = await createTestQuestion({ correctAnswers: [] });

      await expect(useCase.execute(new PublishQuestionCommand(id))).rejects.toThrow(
        ValidationException,
      );
    });

    it('должен разрешать публикацию с большим количеством правильных ответов', async () => {
      const manyAnswers: string[] = Array.from({ length: 10 }, (_, i) => `Answer ${i + 1}`);
      const { id }: Question = await createTestQuestion({ correctAnswers: manyAnswers });

      await useCase.execute(new PublishQuestionCommand(id));

      const publishedQuestion: Question | null = await questionRepo.findOneBy({ id });
      expect(publishedQuestion!.status).toBe(QuestionStatus.Published);
    });

    it('должен работать только со статусом notPublished', async () => {
      const question: Question = await createTestQuestion();
      question.status = QuestionStatus.Published;
      await questionRepo.save(question);

      await expect(useCase.execute(new PublishQuestionCommand(question.id))).rejects.toThrow(
        DomainException,
      );
    });
  });
});
