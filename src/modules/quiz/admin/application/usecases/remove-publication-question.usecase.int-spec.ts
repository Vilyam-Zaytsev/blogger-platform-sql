import { Test, TestingModule } from '@nestjs/testing';
import {
  RemovePublicationQuestionCommand,
  RemovePublicationQuestionUseCase,
} from './remove-publication-question.usecase';
import { DataSource, Repository } from 'typeorm';
import { Question, QuestionStatus } from '../../domain/entities/question.entity';
import { DatabaseModule } from '../../../../database/database.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getRelatedEntities } from '../../../../../core/utils/get-related-entities.utility';
import { QuestionsRepository } from '../../infrastructure/questions-repository';
import { QuestionInputDto } from '../../api/input-dto/question.input-dto';
import { configModule } from '../../../../../dynamic-config.module';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';
import { QuestionValidatorService } from '../../domain/services/question-validator.service';
import { TransactionHelper } from '../../../../database/trasaction.helper';

describe('RemovePublicationQuestionUseCase (Integration)', () => {
  let module: TestingModule;
  let useCase: RemovePublicationQuestionUseCase;
  let questionsRepository: QuestionsRepository;
  let dataSource: DataSource;
  let questionRepo: Repository<Question>;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        configModule,
        DatabaseModule,
        TypeOrmModule.forFeature(getRelatedEntities(Question)),
      ],
      providers: [
        RemovePublicationQuestionUseCase,
        QuestionsRepository,
        QuestionValidatorService,
        TransactionHelper,
      ],
    }).compile();

    useCase = module.get<RemovePublicationQuestionUseCase>(RemovePublicationQuestionUseCase);
    questionsRepository = module.get<QuestionsRepository>(QuestionsRepository);
    dataSource = module.get<DataSource>(DataSource);
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

  describe('Позитивные сценарии', () => {
    it('должен успешно снять с публикации опубликованный вопрос', async () => {
      const { id, publicId }: Question = await createTestPublishedQuestion();

      const questionBeforeUnpublish: Question | null = await questionRepo.findOneBy({ id });
      expect(questionBeforeUnpublish?.status).toBe(QuestionStatus.Published);

      await useCase.execute(new RemovePublicationQuestionCommand(publicId));

      const questionAfterUnpublish: Question | null = await questionRepo.findOneBy({ id });
      expect(questionAfterUnpublish?.status).toBe(QuestionStatus.NotPublished);
    });

    it('должен снять с публикации вопрос с одним ответом', async () => {
      const questionData: QuestionInputDto = {
        body: 'What is TypeScript?',
        correctAnswers: ['A typed superset of JavaScript'],
      };

      const { id, publicId }: Question = await createTestPublishedQuestion(questionData);

      await useCase.execute(new RemovePublicationQuestionCommand(publicId));

      const unpublishedQuestion: Question | null = await questionRepo.findOneBy({ id });
      expect(unpublishedQuestion?.status).toBe(QuestionStatus.NotPublished);
    });

    it('должен снять с публикации вопрос с множественными ответами', async () => {
      const questionData: QuestionInputDto = {
        body: 'Name popular programming languages',
        correctAnswers: ['JavaScript', 'Python', 'Java', 'C#', 'TypeScript'],
      };

      const { id, publicId }: Question = await createTestPublishedQuestion(questionData);

      await useCase.execute(new RemovePublicationQuestionCommand(publicId));

      const unpublishedQuestion: Question | null = await questionRepo.findOneBy({ id });
      expect(unpublishedQuestion?.status).toBe(QuestionStatus.NotPublished);
      expect(unpublishedQuestion?.correctAnswers).toHaveLength(5);
    });

    it('должен сохранить все остальные поля при снятии с публикации', async () => {
      const questionData: QuestionInputDto = {
        body: 'What should remain unchanged?',
        correctAnswers: ['All fields except status'],
      };

      const { id, publicId }: Question = await createTestPublishedQuestion(questionData);

      const originalQuestion: Question | null = await questionRepo.findOneBy({ id });

      await useCase.execute(new RemovePublicationQuestionCommand(publicId));

      const unpublishedQuestion: Question | null = await questionRepo.findOneBy({ id });

      expect(unpublishedQuestion?.id).toBe(originalQuestion?.id);
      expect(unpublishedQuestion?.body).toBe(originalQuestion?.body);
      expect(unpublishedQuestion?.correctAnswers).toEqual(originalQuestion?.correctAnswers);
      expect(unpublishedQuestion?.createdAt).toEqual(originalQuestion?.createdAt);
      expect(unpublishedQuestion?.updatedAt).not.toBeNull();
      expect(unpublishedQuestion?.deletedAt).toBe(originalQuestion?.deletedAt);
    });

    it('должен корректно обновить updatedAt при снятии с публикации', async () => {
      const questionData: QuestionInputDto = {
        body: 'Timestamp test question',
        correctAnswers: ['Test answer'],
      };

      const { id, publicId }: Question = await createTestPublishedQuestion(questionData);

      await new Promise((resolve) => setTimeout(resolve, 10));

      await useCase.execute(new RemovePublicationQuestionCommand(publicId));

      const unpublishedQuestion: Question | null = await questionRepo.findOneBy({ id });

      expect(unpublishedQuestion?.updatedAt).not.toBeNull();
    });
  });

  describe('Обработка ошибок - NotFound', () => {
    it('должен выбросить DomainException NotFound для несуществующего ID', async () => {
      const nonExistentId = '123e4567-e89b-12d3-a456-426614174000';

      try {
        await useCase.execute(new RemovePublicationQuestionCommand(nonExistentId));
        fail('Ожидали DomainException');
      } catch (error) {
        expect(error).toBeInstanceOf(DomainException);
        expect((error as DomainException).code).toBe(DomainExceptionCode.NotFound);
        expect((error as DomainException).message).toBe(
          `The question with ID (${nonExistentId}) does not exist`,
        );
      }
    });

    it('должен выбросить NotFound для удаленного вопроса (soft delete)', async () => {
      const questionData: QuestionInputDto = {
        body: 'This question will be deleted',
        correctAnswers: ['Deleted'],
      };

      const { id, publicId }: Question = await createTestQuestion(questionData);

      await questionRepo.softDelete(id);

      try {
        await useCase.execute(new RemovePublicationQuestionCommand(publicId));
        fail('Ожидали DomainException');
      } catch (error) {
        expect(error).toBeInstanceOf(DomainException);
        expect((error as DomainException).code).toBe(DomainExceptionCode.NotFound);
        expect((error as DomainException).message).toBe(
          `The question with ID (${publicId}) does not exist`,
        );
      }
    });
  });

  describe('Обработка ошибок - BadRequest', () => {
    it('должен выбросить BadRequest при попытке снять с публикации неопубликованный вопрос', async () => {
      const questionData: QuestionInputDto = {
        body: 'This question is not published',
        correctAnswers: ['Not published'],
      };

      const { id, publicId }: Question = await createTestQuestion(questionData);

      const questionBeforeAttempt: Question | null = await questionRepo.findOneBy({ id });
      expect(questionBeforeAttempt?.status).toBe(QuestionStatus.NotPublished);

      try {
        await useCase.execute(new RemovePublicationQuestionCommand(publicId));
        fail('Ожидали DomainException');
      } catch (error) {
        expect(error).toBeInstanceOf(DomainException);
        expect((error as DomainException).code).toBe(DomainExceptionCode.BadRequest);
        expect((error as DomainException).message).toBe(
          'In order to remove a question from publication, it must be published',
        );
      }

      const questionAfterError: Question | null = await questionRepo.findOneBy({ id });
      expect(questionAfterError?.status).toBe(QuestionStatus.NotPublished);
    });

    it('должен выбросить BadRequest для вопроса с пустыми ответами в статусе NotPublished', async () => {
      const questionData: QuestionInputDto = {
        body: 'Question without correct answers',
        correctAnswers: [],
      };

      const { publicId }: Question = await createTestQuestion(questionData);

      try {
        await useCase.execute(new RemovePublicationQuestionCommand(publicId));
        fail('Ожидали DomainException');
      } catch (error) {
        expect(error).toBeInstanceOf(DomainException);
        expect((error as DomainException).code).toBe(DomainExceptionCode.BadRequest);
        expect((error as DomainException).message).toBe(
          'In order to remove a question from publication, it must be published',
        );
      }
    });
  });

  describe('Проверка взаимодействия с репозиторием', () => {
    it('должен вызвать getById и save при успешном снятии с публикации', async () => {
      const questionData: QuestionInputDto = {
        body: 'Repository interaction test',
        correctAnswers: ['Test answer'],
      };

      const { id, publicId }: Question = await createTestPublishedQuestion(questionData);

      const getByPublicIdSpy = jest.spyOn(questionsRepository, 'getByPublicId');
      const saveSpy = jest.spyOn(questionsRepository, 'save');

      await useCase.execute(new RemovePublicationQuestionCommand(publicId));

      expect(getByPublicIdSpy).toHaveBeenCalledWith(publicId);
      expect(getByPublicIdSpy).toHaveBeenCalledTimes(1);

      expect(saveSpy).toHaveBeenCalledTimes(1);
      const savedQuestion: Question = saveSpy.mock.calls[0][0];
      expect(savedQuestion.id).toBe(id);
      expect(savedQuestion.status).toBe(QuestionStatus.NotPublished);

      getByPublicIdSpy.mockRestore();
      saveSpy.mockRestore();
    });

    it('должен вызвать только getById при NotFound ошибке', async () => {
      const nonExistentId = '123e4567-e89b-12d3-a456-426614174000';

      const getByPublicIdSpy = jest.spyOn(questionsRepository, 'getByPublicId');
      const saveSpy = jest.spyOn(questionsRepository, 'save');

      try {
        await useCase.execute(new RemovePublicationQuestionCommand(nonExistentId));
      } catch (error) {
        // Ожидаем ошибку
      }

      expect(getByPublicIdSpy).toHaveBeenCalledWith(nonExistentId);
      expect(getByPublicIdSpy).toHaveBeenCalledTimes(1);
      expect(saveSpy).not.toHaveBeenCalled();

      getByPublicIdSpy.mockRestore();
      saveSpy.mockRestore();
    });

    it('должен вызвать только getById при BadRequest ошибке', async () => {
      const questionData: QuestionInputDto = {
        body: 'BadRequest test question',
        correctAnswers: ['Test'],
      };

      const { publicId }: Question = await createTestQuestion(questionData);

      const getByPublicIdSpy = jest.spyOn(questionsRepository, 'getByPublicId');
      const saveSpy = jest.spyOn(questionsRepository, 'save');

      try {
        await useCase.execute(new RemovePublicationQuestionCommand(publicId));
      } catch (error) {
        // Ожидаем ошибку BadRequest
      }

      expect(getByPublicIdSpy).toHaveBeenCalledWith(publicId);
      expect(getByPublicIdSpy).toHaveBeenCalledTimes(1);
      expect(saveSpy).not.toHaveBeenCalled();

      getByPublicIdSpy.mockRestore();
      saveSpy.mockRestore();
    });
  });

  describe('Множественные операции', () => {
    it('должен корректно снять с публикации несколько вопросов последовательно', async () => {
      const questionsData = [
        { body: 'Question 1 for batch unpublish', correctAnswers: ['Answer 1'] },
        { body: 'Question 2 for batch unpublish', correctAnswers: ['Answer 2'] },
        { body: 'Question 3 for batch unpublish', correctAnswers: ['Answer 3'] },
      ];

      const createdIds: string[] = [];
      for (const data of questionsData) {
        const { publicId }: Question = await createTestPublishedQuestion(data);
        createdIds.push(publicId);
      }

      const publishedQuestions: Question[] = await questionRepo.find({
        where: { status: QuestionStatus.Published },
      });
      expect(publishedQuestions).toHaveLength(3);

      for (const id of createdIds) {
        await useCase.execute(new RemovePublicationQuestionCommand(id));
      }

      const unpublishedQuestions: Question[] = await questionRepo.find({
        where: { status: QuestionStatus.NotPublished },
      });
      expect(unpublishedQuestions).toHaveLength(3);

      const stillPublishedQuestions: Question[] = await questionRepo.find({
        where: { status: QuestionStatus.Published },
      });
      expect(stillPublishedQuestions).toHaveLength(0);
    });

    it('должен корректно обработать параллельное снятие с публикации', async () => {
      const questionsData = [
        { body: 'Parallel unpublish 1', correctAnswers: ['Answer 1'] },
        { body: 'Parallel unpublish 2', correctAnswers: ['Answer 2'] },
        { body: 'Parallel unpublish 3', correctAnswers: ['Answer 3'] },
      ];

      const createdIds: string[] = [];
      for (const data of questionsData) {
        const { publicId }: Question = await createTestPublishedQuestion(data);
        createdIds.push(publicId);
      }

      const unpublishPromises = createdIds.map((id) =>
        useCase.execute(new RemovePublicationQuestionCommand(id)),
      );

      await Promise.all(unpublishPromises);

      const unpublishedQuestions: Question[] = await questionRepo.find({
        where: { status: QuestionStatus.NotPublished },
      });
      expect(unpublishedQuestions).toHaveLength(3);
    });
  });
});
