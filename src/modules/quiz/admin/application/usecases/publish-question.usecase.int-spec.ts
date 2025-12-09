import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, Repository } from 'typeorm';
import { PublishQuestionCommand, PublishQuestionUseCase } from './publish-question.usecase';
import { Question, QuestionStatus } from '../../domain/entities/question.entity';
import { QuestionsRepository } from '../../infrastructure/questions-repository';
import { DatabaseModule } from '../../../../database/database.module';
import { CoreModule } from '../../../../../core/core.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getRelatedEntities } from '../../../../../core/utils/get-related-entities.utility';
import { configModule } from '../../../../../dynamic-config.module';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';
import { ValidationException } from '../../../../../core/exceptions/validation-exception';
import { QuestionInputDto } from '../../api/input-dto/question.input-dto';
import { QuestionValidatorService } from '../../domain/services/question-validator.service';

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
      providers: [PublishQuestionUseCase, QuestionsRepository, QuestionValidatorService],
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
      const { id, publicId, status }: Question = await createTestQuestion();

      expect(status).toBe(QuestionStatus.NotPublished);

      await useCase.execute(new PublishQuestionCommand(publicId));

      const publishedQuestion: Question | null = await questionRepo.findOneBy({ id });

      expect(publishedQuestion).toBeDefined();
      expect(publishedQuestion!.status).toBe(QuestionStatus.Published);
    });

    it('должен опубликовать вопрос с одним правильным ответом', async () => {
      const { id, publicId }: Question = await createTestQuestion({
        body: 'What is 2+2?',
        correctAnswers: ['4'],
      });

      await useCase.execute(new PublishQuestionCommand(publicId));

      const publishedQuestion: Question | null = await questionRepo.findOneBy({ id });
      expect(publishedQuestion!.status).toBe(QuestionStatus.Published);
    });

    it('должен опубликовать вопрос с множественными правильными ответами', async () => {
      const { id, publicId }: Question = await createTestQuestion({
        body: 'Which are programming languages?',
        correctAnswers: ['JavaScript', 'Python', 'Java', 'TypeScript'],
      });

      await useCase.execute(new PublishQuestionCommand(publicId));

      const publishedQuestion: Question | null = await questionRepo.findOneBy({ id });
      expect(publishedQuestion!.status).toBe(QuestionStatus.Published);
    });

    it('должен обновить только статус публикации не затрагивая другие поля', async () => {
      const question: Question = await createTestQuestion();
      const originalBody: string = question.body;
      const originalAnswers: string[] = [...question.correctAnswers];
      const originalCreatedAt: Date = question.createdAt;

      await useCase.execute(new PublishQuestionCommand(question.publicId));

      const publishedQuestion: Question | null = await questionRepo.findOneBy({ id: question.id });

      expect(publishedQuestion!.body).toBe(originalBody);
      expect(publishedQuestion!.correctAnswers).toEqual(originalAnswers);
      expect(publishedQuestion!.createdAt).toEqual(originalCreatedAt);
      expect(publishedQuestion!.updatedAt).not.toBeNull();
      expect(publishedQuestion!.status).toBe(QuestionStatus.Published);
    });
  });

  describe('обработка ошибок домена', () => {
    it('должен выбросить DomainException при попытке опубликовать несуществующий вопрос', async () => {
      const nonExistentId = '123e4567-e89b-12d3-a456-426614174000';

      await expect(useCase.execute(new PublishQuestionCommand(nonExistentId))).rejects.toThrow(
        DomainException,
      );
    });

    it('должен выбросить DomainException с правильным кодом NotFound для несуществующего вопроса', async () => {
      const nonExistentId = '123e4567-e89b-12d3-a456-426614174000';

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
      const { publicId }: Question = await createTestQuestion();

      await useCase.execute(new PublishQuestionCommand(publicId));

      await expect(useCase.execute(new PublishQuestionCommand(publicId))).rejects.toThrow(
        DomainException,
      );
    });

    it('должен выбросить DomainException с правильным кодом BadRequest для уже опубликованного вопроса', async () => {
      const { publicId }: Question = await createTestQuestion();

      await useCase.execute(new PublishQuestionCommand(publicId));

      try {
        await useCase.execute(new PublishQuestionCommand(publicId));
        fail('Ожидали DomainException');
      } catch (error) {
        expect(error).toBeInstanceOf(DomainException);
        expect((error as DomainException).code).toBe(DomainExceptionCode.BadRequest);
        expect((error as DomainException).message).toContain(
          `The question with ID (${publicId}) already published`,
        );
      }
    });

    it('должен выбросить ValidationException при попытке опубликовать вопрос без правильных ответов', async () => {
      const { publicId }: Question = await createTestQuestion({
        body: 'Question without correct answers',
        correctAnswers: [],
      });

      await expect(useCase.execute(new PublishQuestionCommand(publicId))).rejects.toThrow(
        ValidationException,
      );
    });

    it('должен выбросить ValidationException с правильным сообщением для вопроса без правильных ответов', async () => {
      const { publicId }: Question = await createTestQuestion({
        correctAnswers: [],
      });

      try {
        await useCase.execute(new PublishQuestionCommand(publicId));
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
      const { id, publicId }: Question = await createTestQuestion({ correctAnswers: [] });

      await expect(useCase.execute(new PublishQuestionCommand(publicId))).rejects.toThrow(
        ValidationException,
      );

      const unchangedQuestion: Question | null = await questionRepo.findOneBy({ id });
      expect(unchangedQuestion!.status).toBe(QuestionStatus.NotPublished);
    });

    it('не должен изменить статус при попытке опубликовать уже опубликованный вопрос', async () => {
      const { id, publicId }: Question = await createTestQuestion();

      await useCase.execute(new PublishQuestionCommand(publicId));

      const firstPublishedQuestion: Question | null = await questionRepo.findOneBy({
        id,
      });
      const firstUpdatedAt: Date = firstPublishedQuestion!.updatedAt!;

      await new Promise((resolve) => setTimeout(resolve, 10));

      await expect(useCase.execute(new PublishQuestionCommand(publicId))).rejects.toThrow(
        DomainException,
      );

      const secondPublishedQuestion: Question | null = await questionRepo.findOneBy({
        id,
      });
      expect(secondPublishedQuestion!.status).toBe(QuestionStatus.Published);
      expect(secondPublishedQuestion!.updatedAt).toEqual(firstUpdatedAt);
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
        useCase.execute(new PublishQuestionCommand(question.publicId)),
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
      const { id, publicId }: Question = await createTestQuestion();

      await useCase.execute(new PublishQuestionCommand(publicId));

      for (let i = 0; i < 3; i++) {
        await expect(useCase.execute(new PublishQuestionCommand(publicId))).rejects.toThrow(
          DomainException,
        );
      }

      const finalQuestion: Question | null = await questionRepo.findOneBy({ id });
      expect(finalQuestion!.status).toBe(QuestionStatus.Published);
    });
  });

  describe('интеграция с repository', () => {
    it('должен правильно вызывать методы repository в нужном порядке', async () => {
      const { publicId }: Question = await createTestQuestion();

      const getByPublicIdSpy = jest.spyOn(questionsRepository, 'getByPublicId');
      const saveSpy = jest.spyOn(questionsRepository, 'save');

      await useCase.execute(new PublishQuestionCommand(publicId));

      expect(getByPublicIdSpy).toHaveBeenCalledWith(publicId);
      expect(getByPublicIdSpy).toHaveBeenCalledTimes(1);
      expect(saveSpy).toHaveBeenCalledTimes(1);

      const getByIdCall: number = getByPublicIdSpy.mock.invocationCallOrder[0];
      const saveCall: number = saveSpy.mock.invocationCallOrder[0];
      expect(getByIdCall).toBeLessThan(saveCall);

      const saveCallArgs: Question = saveSpy.mock.calls[0][0];
      expect(saveCallArgs).toBeInstanceOf(Question);
      expect(saveCallArgs.status).toBe(QuestionStatus.Published);

      getByPublicIdSpy.mockRestore();
      saveSpy.mockRestore();
    });

    it('не должен вызывать save если вопрос не найден', async () => {
      const nonExistentId = '123e4567-e89b-12d3-a456-426614174000';

      const saveSpy = jest.spyOn(questionsRepository, 'save');

      await expect(useCase.execute(new PublishQuestionCommand(nonExistentId))).rejects.toThrow(
        DomainException,
      );

      expect(saveSpy).not.toHaveBeenCalled();

      saveSpy.mockRestore();
    });

    it('не должен вызывать save если вопрос уже опубликован', async () => {
      const { publicId }: Question = await createTestQuestion();

      await useCase.execute(new PublishQuestionCommand(publicId));

      const saveSpy = jest.spyOn(questionsRepository, 'save');

      await expect(useCase.execute(new PublishQuestionCommand(publicId))).rejects.toThrow(
        DomainException,
      );

      expect(saveSpy).not.toHaveBeenCalled();

      saveSpy.mockRestore();
    });

    it('не должен вызывать save если нет правильных ответов', async () => {
      const { publicId }: Question = await createTestQuestion({ correctAnswers: [] });

      const saveSpy = jest.spyOn(questionsRepository, 'save');

      await expect(useCase.execute(new PublishQuestionCommand(publicId))).rejects.toThrow(
        ValidationException,
      );

      expect(saveSpy).not.toHaveBeenCalled();

      saveSpy.mockRestore();
    });
  });

  describe('валидация business-правил', () => {
    it('должен требовать минимум один правильный ответ', async () => {
      const { publicId }: Question = await createTestQuestion({ correctAnswers: [] });

      await expect(useCase.execute(new PublishQuestionCommand(publicId))).rejects.toThrow(
        ValidationException,
      );
    });

    it('должен разрешать публикацию с большим количеством правильных ответов', async () => {
      const manyAnswers: string[] = Array.from({ length: 10 }, (_, i) => `Answer ${i + 1}`);
      const { id, publicId }: Question = await createTestQuestion({ correctAnswers: manyAnswers });

      await useCase.execute(new PublishQuestionCommand(publicId));

      const publishedQuestion: Question | null = await questionRepo.findOneBy({ id });
      expect(publishedQuestion!.status).toBe(QuestionStatus.Published);
    });

    it('должен работать только со статусом notPublished', async () => {
      const question: Question = await createTestQuestion();
      question.status = QuestionStatus.Published;
      await questionRepo.save(question);

      await expect(useCase.execute(new PublishQuestionCommand(question.publicId))).rejects.toThrow(
        DomainException,
      );
    });
  });
});
