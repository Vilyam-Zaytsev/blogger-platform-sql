import { Test, TestingModule } from '@nestjs/testing';
import { DeleteQuestionCommand, DeleteQuestionUseCase } from './delete-question.usecase';
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
import { TransactionHelper } from '../../../../database/trasaction.helper';

describe('DeleteQuestionUseCase (Integration)', () => {
  let module: TestingModule;
  let useCase: DeleteQuestionUseCase;
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
      providers: [DeleteQuestionUseCase, QuestionsRepository, TransactionHelper],
    }).compile();

    useCase = module.get<DeleteQuestionUseCase>(DeleteQuestionUseCase);
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
    it('должен успешно удалить (soft delete) неопубликованный вопрос', async () => {
      const { id, publicId }: Question = await createTestQuestion();
      const questionBeforeDelete: Question | null = await questionRepo.findOneBy({ id });
      expect(questionBeforeDelete).toBeDefined();
      expect(questionBeforeDelete?.deletedAt).toBeNull();

      await useCase.execute(new DeleteQuestionCommand(publicId));

      const questionAfterDelete: Question | null = await questionRepo
        .createQueryBuilder()
        .where('id = :id', { id })
        .withDeleted()
        .getOne();

      expect(questionAfterDelete).toBeDefined();
      expect(questionAfterDelete?.deletedAt).not.toBeNull();
      expect(questionAfterDelete?.deletedAt).toBeInstanceOf(Date);
    });

    it('должен успешно удалить (soft delete) опубликованный вопрос', async () => {
      const { id, publicId }: Question = await createTestPublishedQuestion();

      const questionBeforeDelete: Question | null = await questionRepo.findOneBy({ id });
      expect(questionBeforeDelete?.status).toBe(QuestionStatus.Published);
      expect(questionBeforeDelete?.deletedAt).toBeNull();

      await useCase.execute(new DeleteQuestionCommand(publicId));

      const questionAfterDelete: Question | null = await questionRepo
        .createQueryBuilder()
        .where('id = :id', { id })
        .withDeleted()
        .getOne();

      expect(questionAfterDelete?.deletedAt).not.toBeNull();
      expect(questionAfterDelete?.status).toBe(QuestionStatus.Published);
    });

    it('должен сохранить все данные вопроса при soft delete', async () => {
      const questionData: QuestionInputDto = {
        body: 'What is TypeScript?',
        correctAnswers: ['A typed superset of JavaScript', 'Developed by Microsoft'],
      };

      const { id, publicId }: Question = await createTestPublishedQuestion(questionData);

      const questionBeforeDelete: Question | null = await questionRepo.findOneBy({ id });
      expect(questionBeforeDelete).toBeDefined();

      await useCase.execute(new DeleteQuestionCommand(publicId));

      const deletedQuestion: Question | null = await questionRepo
        .createQueryBuilder()
        .where('id = :id', { id })
        .withDeleted()
        .getOne();

      expect(deletedQuestion?.id).toBe(id);
      expect(deletedQuestion?.body).toBe(questionData.body);
      expect(deletedQuestion?.correctAnswers).toEqual(questionData.correctAnswers);
      expect(deletedQuestion?.status).toBe(QuestionStatus.Published);
      expect(deletedQuestion?.createdAt).toEqual(questionBeforeDelete?.createdAt);
      expect(deletedQuestion?.updatedAt?.getTime()).toBeGreaterThan(
        new Date(questionBeforeDelete!.updatedAt!).getTime(),
      );
    });
  });

  describe('Обработка ошибок - NotFound', () => {
    it('должен выбросить DomainException NotFound для несуществующего ID', async () => {
      const nonExistentId = '123e4567-e89b-12d3-a456-426614174000';

      try {
        await useCase.execute(new DeleteQuestionCommand(nonExistentId));
        fail('Ожидали DomainException');
      } catch (error) {
        expect(error).toBeInstanceOf(DomainException);
        expect((error as DomainException).code).toBe(DomainExceptionCode.NotFound);
        expect((error as DomainException).message).toBe(
          `The question with ID (${nonExistentId}) does not exist`,
        );
      }
    });

    it('должен выбросить NotFound при попытке удалить уже удаленный вопрос', async () => {
      const questionData: QuestionInputDto = {
        body: 'Question to delete twice',
        correctAnswers: ['Answer'],
      };

      const { id, publicId }: Question = await createTestQuestion(questionData);

      await useCase.execute(new DeleteQuestionCommand(publicId));

      const firstDeletedQuestion: Question | null = await questionRepo
        .createQueryBuilder()
        .where('id = :id', { id })
        .withDeleted()
        .getOne();

      expect(firstDeletedQuestion?.deletedAt).not.toBeNull();

      try {
        await useCase.execute(new DeleteQuestionCommand(publicId));
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

  describe('Проверка взаимодействия с репозиторием', () => {
    it('должен вызвать getByPublicId и softDelete при успешном удалении', async () => {
      const { id, publicId }: Question = await createTestQuestion();

      const getByPublicIdSpy = jest.spyOn(questionsRepository, 'getByPublicId');
      const softDeleteSpy = jest.spyOn(questionsRepository, 'softDelete');

      await useCase.execute(new DeleteQuestionCommand(publicId));

      expect(getByPublicIdSpy).toHaveBeenCalledWith(publicId);
      expect(getByPublicIdSpy).toHaveBeenCalledTimes(1);

      expect(softDeleteSpy).toHaveBeenCalledWith(id);
      expect(softDeleteSpy).toHaveBeenCalledTimes(1);

      getByPublicIdSpy.mockRestore();
      softDeleteSpy.mockRestore();
    });

    it('должен вызвать только getByPublicId при NotFound ошибке', async () => {
      const nonExistentId = '123e4567-e89b-12d3-a456-426614174000';

      const getByPublicIdSpy = jest.spyOn(questionsRepository, 'getByPublicId');
      const softDeleteSpy = jest.spyOn(questionsRepository, 'softDelete');

      try {
        await useCase.execute(new DeleteQuestionCommand(nonExistentId));
      } catch (error) {
        // Ожидаем ошибку
      }

      expect(getByPublicIdSpy).toHaveBeenCalledWith(nonExistentId);
      expect(getByPublicIdSpy).toHaveBeenCalledTimes(1);
      expect(softDeleteSpy).not.toHaveBeenCalled();

      getByPublicIdSpy.mockRestore();
      softDeleteSpy.mockRestore();
    });

    it('должен передать правильный ID в softDelete', async () => {
      const { id, publicId }: Question = await createTestQuestion();

      const softDeleteSpy = jest.spyOn(questionsRepository, 'softDelete');

      await useCase.execute(new DeleteQuestionCommand(publicId));

      expect(softDeleteSpy).toHaveBeenCalledWith(id);
      expect(softDeleteSpy.mock.calls[0][0]).toBe(id);

      softDeleteSpy.mockRestore();
    });
  });
});
