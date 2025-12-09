import { Test, TestingModule } from '@nestjs/testing';
import { UpdateQuestionCommand, UpdateQuestionUseCase } from './update-question.usecase';
import { DataSource, In, Repository } from 'typeorm';
import { Question, QuestionStatus } from '../../domain/entities/question.entity';
import { DatabaseModule } from '../../../../database/database.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getRelatedEntities } from '../../../../../core/utils/get-related-entities.utility';
import { QuestionsRepository } from '../../infrastructure/questions-repository';
import { QuestionInputDto } from '../../api/input-dto/question.input-dto';
import { QuestionUpdateDto } from '../dto/question.update-dto';
import { configModule } from '../../../../../dynamic-config.module';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';
import { ValidationException } from '../../../../../core/exceptions/validation-exception';
import { QuestionValidatorService } from '../../domain/services/question-validator.service';

describe('UpdateQuestionUseCase (Integration)', () => {
  let module: TestingModule;
  let useCase: UpdateQuestionUseCase;
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
      providers: [UpdateQuestionUseCase, QuestionsRepository, QuestionValidatorService],
    }).compile();

    useCase = module.get<UpdateQuestionUseCase>(UpdateQuestionUseCase);
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
    it('должен успешно обновить body неопубликованного вопроса', async () => {
      const { id, publicId, body: beforeUpdateBody }: Question = await createTestQuestion();

      const updateDto: QuestionUpdateDto = {
        id: publicId,
        body: 'What is the capital of Germany?',
        correctAnswers: ['Berlin'],
      };

      const questionBeforeUpdate: Question | null = await questionRepo.findOneBy({ id });
      expect(questionBeforeUpdate?.body).toBe(beforeUpdateBody);

      await useCase.execute(new UpdateQuestionCommand(updateDto));

      const questionAfterUpdate: Question | null = await questionRepo.findOneBy({ id });
      expect(questionAfterUpdate?.body).toBe(updateDto.body);
      expect(questionAfterUpdate?.correctAnswers).toEqual(updateDto.correctAnswers);
    });

    it('должен успешно обновить body опубликованного вопроса', async () => {
      const { id, publicId }: Question = await createTestPublishedQuestion();

      const updateDto: QuestionUpdateDto = {
        id: publicId,
        body: 'Updated published question',
        correctAnswers: ['Answer 1', 'Answer 2'],
      };

      await useCase.execute(new UpdateQuestionCommand(updateDto));

      const updatedQuestion: Question | null = await questionRepo.findOneBy({ id });
      expect(updatedQuestion?.body).toBe(updateDto.body);
      expect(updatedQuestion?.status).toBe(QuestionStatus.Published);
    });

    it('должен успешно обновить correctAnswers опубликованного вопроса с минимум одним ответом', async () => {
      const { id, publicId }: Question = await createTestPublishedQuestion();

      const updateDto: QuestionUpdateDto = {
        id: publicId,
        body: 'Name popular programming languages',
        correctAnswers: ['JavaScript', 'Python', 'Java'],
      };

      await useCase.execute(new UpdateQuestionCommand(updateDto));

      const updatedQuestion: Question | null = await questionRepo.findOneBy({ id });
      expect(updatedQuestion?.correctAnswers).toHaveLength(3);
      expect(updatedQuestion?.correctAnswers).toEqual(updateDto.correctAnswers);
    });

    it('должен успешно обновить оба поля неопубликованного вопроса', async () => {
      const { id, publicId }: Question = await createTestQuestion();

      const updateDto: QuestionUpdateDto = {
        id: publicId,
        body: 'What is TypeScript?',
        correctAnswers: ['A typed superset of JavaScript'],
      };

      await useCase.execute(new UpdateQuestionCommand(updateDto));

      const updatedQuestion: Question | null = await questionRepo.findOneBy({ id });
      expect(updatedQuestion?.body).toBe(updateDto.body);
      expect(updatedQuestion?.correctAnswers).toEqual(updateDto.correctAnswers);
    });

    it('должен обновить вопрос, сохраняя его статус Published', async () => {
      const questionData: QuestionInputDto = {
        body: 'Original question',
        correctAnswers: ['Original answer'],
      };

      const { id, publicId }: Question = await createTestPublishedQuestion(questionData);

      const publishedQuestionBefore: Question | null = await questionRepo.findOneBy({ id });
      expect(publishedQuestionBefore?.status).toBe(QuestionStatus.Published);

      const updateDto: QuestionUpdateDto = {
        id: publicId,
        body: 'Updated question',
        correctAnswers: ['Updated answer'],
      };

      await useCase.execute(new UpdateQuestionCommand(updateDto));

      const updatedQuestion: Question | null = await questionRepo.findOneBy({ id });
      expect(updatedQuestion?.status).toBe(QuestionStatus.Published);
      expect(updatedQuestion?.body).toBe(updateDto.body);
      expect(updatedQuestion?.correctAnswers).toEqual(updateDto.correctAnswers);
    });

    it('должен корректно обновить updatedAt при изменении вопроса', async () => {
      const { id, publicId }: Question = await createTestQuestion();

      const originalQuestion: Question | null = await questionRepo.findOneBy({ id });
      const originalUpdatedAt = originalQuestion?.updatedAt;
      console.log(originalUpdatedAt);
      await new Promise((resolve) => setTimeout(resolve, 10));

      const updateDto: QuestionUpdateDto = {
        id: publicId,
        body: 'Updated body',
        correctAnswers: ['Updated answer'],
      };

      await useCase.execute(new UpdateQuestionCommand(updateDto));

      const updatedQuestion: Question | null = await questionRepo.findOneBy({ id });

      expect(updatedQuestion?.updatedAt!.getTime()).toBeGreaterThan(
        originalUpdatedAt?.getTime() || 0,
      );
    });

    it('должен сохранить createdAt при обновлении вопроса', async () => {
      const { id, publicId }: Question = await createTestQuestion();

      const originalQuestion: Question | null = await questionRepo.findOneBy({ id });
      const originalCreatedAt = originalQuestion?.createdAt;

      const updateDto: QuestionUpdateDto = {
        id: publicId,
        body: 'Updated body',
        correctAnswers: ['Updated answer'],
      };

      await useCase.execute(new UpdateQuestionCommand(updateDto));

      const updatedQuestion: Question | null = await questionRepo.findOneBy({ id });

      expect(updatedQuestion?.createdAt).toEqual(originalCreatedAt);
    });

    it('должен обновить опубликованный вопрос, оставив correctAnswers с одним ответом', async () => {
      const { id, publicId }: Question = await createTestPublishedQuestion({
        body: 'Multiple answers question',
        correctAnswers: ['Answer 1', 'Answer 2', 'Answer 3'],
      });

      const updateDto: QuestionUpdateDto = {
        id: publicId,
        body: 'Single answer question',
        correctAnswers: ['Single answer'],
      };

      await useCase.execute(new UpdateQuestionCommand(updateDto));

      const updatedQuestion: Question | null = await questionRepo.findOneBy({ id });
      expect(updatedQuestion?.correctAnswers).toHaveLength(1);
      expect(updatedQuestion?.correctAnswers).toEqual(updateDto.correctAnswers);
      expect(updatedQuestion?.status).toBe(QuestionStatus.Published);
    });

    it('должен обновить неопубликованный вопрос с пустыми correctAnswers', async () => {
      const { id, publicId }: Question = await createTestQuestion();

      const updateDto: QuestionUpdateDto = {
        id: publicId,
        body: 'Question without answers',
        correctAnswers: [],
      };

      await useCase.execute(new UpdateQuestionCommand(updateDto));

      const updatedQuestion: Question | null = await questionRepo.findOneBy({ id });
      expect(updatedQuestion?.correctAnswers).toEqual([]);
      expect(updatedQuestion?.status).toBe(QuestionStatus.NotPublished);
    });
  });

  describe('Обработка ошибок - NotFound', () => {
    it('должен выбросить DomainException NotFound для несуществующего ID', async () => {
      const nonExistentId = '123e4567-e89b-12d3-a456-426614174000';

      const updateDto: QuestionUpdateDto = {
        id: nonExistentId,
        body: 'Updated body',
        correctAnswers: ['Updated answer'],
      };

      try {
        await useCase.execute(new UpdateQuestionCommand(updateDto));
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

      const updateDto: QuestionUpdateDto = {
        id: publicId,
        body: 'Updated body',
        correctAnswers: ['Updated answer'],
      };

      try {
        await useCase.execute(new UpdateQuestionCommand(updateDto));
        fail('Ожидали DomainException');
      } catch (error) {
        expect(error).toBeInstanceOf(DomainException);
        expect((error as DomainException).code).toBe(DomainExceptionCode.NotFound);
      }
    });
  });

  describe('Обработка ошибок - ValidationException (публикованные вопросы)', () => {
    it('должен выбросить ValidationException при попытке обновить опубликованный вопрос без ответов', async () => {
      const { id, publicId }: Question = await createTestPublishedQuestion({
        body: 'Published question',
        correctAnswers: ['Answer 1'],
      });

      const publishedQuestionBefore: Question | null = await questionRepo.findOneBy({ id });
      expect(publishedQuestionBefore?.status).toBe(QuestionStatus.Published);

      const updateDto: QuestionUpdateDto = {
        id: publicId,
        body: 'Updated published question',
        correctAnswers: [],
      };

      try {
        await useCase.execute(new UpdateQuestionCommand(updateDto));
        fail('Ожидали ValidationException');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationException);
        expect((error as ValidationException).code).toBe('ValidationError');
        expect((error as ValidationException).extensions[0].field).toBe('correctAnswers');
        expect((error as ValidationException).extensions[0].message).toContain(
          'Cannot publish question without correct answers',
        );
      }

      const questionAfterError: Question | null = await questionRepo.findOneBy({ id });
      expect(questionAfterError?.correctAnswers).toEqual(['Answer 1']);
    });

    it('должен позволить обновить неопубликованный вопрос с пустыми correctAnswers', async () => {
      const { id, publicId }: Question = await createTestQuestion({
        body: 'Not published question',
        correctAnswers: ['Answer 1'],
      });

      const notPublishedBefore: Question | null = await questionRepo.findOneBy({ id });
      expect(notPublishedBefore?.status).toBe(QuestionStatus.NotPublished);

      const updateDto: QuestionUpdateDto = {
        id: publicId,
        body: 'Updated not published question',
        correctAnswers: [],
      };

      await useCase.execute(new UpdateQuestionCommand(updateDto));

      const updatedQuestion: Question | null = await questionRepo.findOneBy({ id });
      expect(updatedQuestion?.correctAnswers).toEqual([]);
      expect(updatedQuestion?.status).toBe(QuestionStatus.NotPublished);
    });
  });

  describe('Проверка взаимодействия с репозиторием', () => {
    it('должен вызвать getById и save при успешном обновлении опубликованного вопроса', async () => {
      const questionData: QuestionInputDto = {
        body: 'Repository interaction test',
        correctAnswers: ['Test answer'],
      };

      const { id, publicId }: Question = await createTestPublishedQuestion(questionData);

      const getByPublicIdSpy = jest.spyOn(questionsRepository, 'getByPublicId');
      const saveSpy = jest.spyOn(questionsRepository, 'save');

      const updateDto: QuestionUpdateDto = {
        id: publicId,
        body: 'Updated body',
        correctAnswers: ['Updated answer'],
      };

      await useCase.execute(new UpdateQuestionCommand(updateDto));

      expect(getByPublicIdSpy).toHaveBeenCalledWith(publicId);
      expect(getByPublicIdSpy).toHaveBeenCalledTimes(1);

      expect(saveSpy).toHaveBeenCalledTimes(1);
      const savedQuestion: Question = saveSpy.mock.calls[0][0];
      expect(savedQuestion.id).toBe(id);
      expect(savedQuestion.body).toBe('Updated body');
      expect(savedQuestion.correctAnswers).toEqual(['Updated answer']);

      getByPublicIdSpy.mockRestore();
      saveSpy.mockRestore();
    });

    it('должен вызвать только getById при NotFound ошибке', async () => {
      const nonExistentId = '123e4567-e89b-12d3-a456-426614174000';

      const getByPublicIdSpy = jest.spyOn(questionsRepository, 'getByPublicId');
      const saveSpy = jest.spyOn(questionsRepository, 'save');

      const updateDto: QuestionUpdateDto = {
        id: nonExistentId,
        body: 'Updated body',
        correctAnswers: ['Updated answer'],
      };

      try {
        await useCase.execute(new UpdateQuestionCommand(updateDto));
      } catch (error) {
        // Ожидаем ошибку
      }

      expect(getByPublicIdSpy).toHaveBeenCalledWith(nonExistentId);
      expect(getByPublicIdSpy).toHaveBeenCalledTimes(1);
      expect(saveSpy).not.toHaveBeenCalled();

      getByPublicIdSpy.mockRestore();
      saveSpy.mockRestore();
    });

    it('должен вызвать только getById при ValidationException ошибке (пустые ответы у published)', async () => {
      const { publicId }: Question = await createTestPublishedQuestion({
        correctAnswers: ['Answer'],
      });

      const getByPublicIdSpy = jest.spyOn(questionsRepository, 'getByPublicId');
      const saveSpy = jest.spyOn(questionsRepository, 'save');

      const updateDto: QuestionUpdateDto = {
        id: publicId,
        body: 'Updated body',
        correctAnswers: [],
      };

      try {
        await useCase.execute(new UpdateQuestionCommand(updateDto));
      } catch (error) {
        // Ожидаем ValidationException
      }

      expect(getByPublicIdSpy).toHaveBeenCalledWith(publicId);
      expect(getByPublicIdSpy).toHaveBeenCalledTimes(1);
      expect(saveSpy).not.toHaveBeenCalled();

      getByPublicIdSpy.mockRestore();
      saveSpy.mockRestore();
    });

    it('должен правильно передать объект Question в save для опубликованного вопроса', async () => {
      const questionData: QuestionInputDto = {
        body: 'Original question',
        correctAnswers: ['Original answer'],
      };

      const { id, publicId }: Question = await createTestPublishedQuestion(questionData);

      const saveSpy = jest.spyOn(questionsRepository, 'save');

      const updateDto: QuestionUpdateDto = {
        id: publicId,
        body: 'Updated question',
        correctAnswers: ['Updated answer 1', 'Updated answer 2'],
      };

      await useCase.execute(new UpdateQuestionCommand(updateDto));

      expect(saveSpy).toHaveBeenCalledTimes(1);
      const savedQuestion = saveSpy.mock.calls[0][0];
      expect(savedQuestion).toBeInstanceOf(Question);
      expect(savedQuestion.id).toBe(id);
      expect(savedQuestion.status).toBe(QuestionStatus.Published);

      saveSpy.mockRestore();
    });
  });

  describe('Множественные операции', () => {
    it('должен корректно обновить несколько опубликованных вопросов последовательно', async () => {
      const questionsData = [
        { body: 'Published Question 1', correctAnswers: ['Answer 1'] },
        { body: 'Published Question 2', correctAnswers: ['Answer 2'] },
        { body: 'Published Question 3', correctAnswers: ['Answer 3'] },
      ];

      const createdIds: string[] = [];
      for (const data of questionsData) {
        const { publicId }: Question = await createTestPublishedQuestion(data);
        createdIds.push(publicId);
      }

      const updateDtos: QuestionUpdateDto[] = [
        { id: createdIds[0], body: 'Updated Q1', correctAnswers: ['Updated A1'] },
        { id: createdIds[1], body: 'Updated Q2', correctAnswers: ['Updated A2'] },
        { id: createdIds[2], body: 'Updated Q3', correctAnswers: ['Updated A3'] },
      ];

      for (const updateDto of updateDtos) {
        await useCase.execute(new UpdateQuestionCommand(updateDto));
      }

      const updatedQuestions: Question[] = await questionRepo.find({
        where: {
          publicId: In(createdIds),
        },
      });
      expect(updatedQuestions).toHaveLength(3);
      expect(updatedQuestions.every((q) => q.status === QuestionStatus.Published)).toBe(true);
      expect(updatedQuestions[0].body).toBe('Updated Q1');
      expect(updatedQuestions[1].body).toBe('Updated Q2');
      expect(updatedQuestions[2].body).toBe('Updated Q3');
    });

    it('должен корректно обработать параллельное обновление опубликованных вопросов', async () => {
      const questionsData = [
        { body: 'Parallel published 1', correctAnswers: ['Answer 1'] },
        { body: 'Parallel published 2', correctAnswers: ['Answer 2'] },
        { body: 'Parallel published 3', correctAnswers: ['Answer 3'] },
      ];

      const createdIds: string[] = [];
      for (const data of questionsData) {
        const { publicId }: Question = await createTestPublishedQuestion(data);
        createdIds.push(publicId);
      }

      const updateDtos: QuestionUpdateDto[] = [
        { id: createdIds[0], body: 'Parallel Updated Q1', correctAnswers: ['Updated A1'] },
        { id: createdIds[1], body: 'Parallel Updated Q2', correctAnswers: ['Updated A2'] },
        { id: createdIds[2], body: 'Parallel Updated Q3', correctAnswers: ['Updated A3'] },
      ];

      const updatePromises = updateDtos.map((dto) =>
        useCase.execute(new UpdateQuestionCommand(dto)),
      );

      await Promise.all(updatePromises);

      const updatedQuestions: Question[] = await questionRepo.find({
        where: {
          publicId: In(createdIds),
        },
      });
      expect(updatedQuestions).toHaveLength(3);
      expect(updatedQuestions.every((q) => q.body.includes('Parallel Updated'))).toBe(true);
      expect(updatedQuestions.every((q) => q.status === QuestionStatus.Published)).toBe(true);
    });

    it('должен корректно обновить один и тот же опубликованный вопрос несколько раз подряд', async () => {
      const { id, publicId }: Question = await createTestPublishedQuestion();

      const updates = [
        { id: publicId, body: 'First update', correctAnswers: ['Answer 1'] },
        { id: publicId, body: 'Second update', correctAnswers: ['Answer 2', 'Answer 2b'] },
        { id: publicId, body: 'Third update', correctAnswers: ['Answer 3'] },
      ];

      for (const updateDto of updates) {
        await useCase.execute(new UpdateQuestionCommand(updateDto));
      }

      const finalQuestion: Question | null = await questionRepo.findOneBy({ id });
      expect(finalQuestion?.body).toBe('Third update');
      expect(finalQuestion?.correctAnswers).toEqual(['Answer 3']);
      expect(finalQuestion?.status).toBe(QuestionStatus.Published);
    });

    it('должен обновить смешанный список: опубликованные вопросы успешно, неопубликованные с пустыми ответами тоже', async () => {
      const { id: publishedId, publicId: publishedPublicId }: Question =
        await createTestPublishedQuestion({
          correctAnswers: ['Published Answer'],
        });

      const { id: notPublishedId, publicId: notPublishedPublicId }: Question =
        await createTestQuestion({ correctAnswers: ['Not Published Answer'] });

      const publishedUpdate: QuestionUpdateDto = {
        id: publishedPublicId,
        body: 'Updated published with answer',
        correctAnswers: ['Updated Published Answer'],
      };

      const notPublishedUpdate: QuestionUpdateDto = {
        id: notPublishedPublicId,
        body: 'Updated not published without answers',
        correctAnswers: [],
      };

      await useCase.execute(new UpdateQuestionCommand(publishedUpdate));
      await useCase.execute(new UpdateQuestionCommand(notPublishedUpdate));

      const publishedAfter: Question | null = await questionRepo.findOneBy({ id: publishedId });
      const notPublishedAfter: Question | null = await questionRepo.findOneBy({
        id: notPublishedId,
      });

      expect(publishedAfter?.status).toBe(QuestionStatus.Published);
      expect(publishedAfter?.correctAnswers).toEqual(['Updated Published Answer']);

      expect(notPublishedAfter?.status).toBe(QuestionStatus.NotPublished);
      expect(notPublishedAfter?.correctAnswers).toEqual([]);
    });
  });
});
