import { Test, TestingModule } from '@nestjs/testing';
import { CreateQuestionCommand, CreateQuestionUseCase } from './create-question.usecase';
import { DataSource, Repository } from 'typeorm';
import {
  bodyConstraints,
  correctAnswersConstraints,
  Question,
  QuestionStatus,
} from '../../domain/entities/question.entity';
import { DatabaseModule } from '../../../../database/database.module';
import { CoreModule } from '../../../../../core/core.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getRelatedEntities } from '../../../../../core/utils/get-related-entities.utility';
import { QuestionsRepository } from '../../infrastructure/questions-repository';
import { QuestionInputDto } from '../../api/input-dto/question.input-dto';
import { configModule } from '../../../../../dynamic-config.module';

describe('CreateQuestionUseCase (Integration)', () => {
  let module: TestingModule;
  let useCase: CreateQuestionUseCase;
  let dataSource: DataSource;
  let questionRepo: Repository<Question>;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        configModule,
        DatabaseModule,
        CoreModule,
        TypeOrmModule.forFeature(getRelatedEntities(Question)),
      ],
      providers: [CreateQuestionUseCase, QuestionsRepository],
    }).compile();

    useCase = module.get<CreateQuestionUseCase>(CreateQuestionUseCase);
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

  describe('Позитивные сценарии', () => {
    it('должен успешно создать вопрос с корректными данными и вернуть ID', async () => {
      const dto: QuestionInputDto = {
        body: 'What is the capital of France?',
        correctAnswers: ['Paris', 'paris', 'PARIS'],
      };

      const questionId: number = await useCase.execute(new CreateQuestionCommand(dto));

      expect(questionId).toBeDefined();
      expect(typeof questionId).toBe('number');
      expect(questionId).toBeGreaterThan(0);

      const createdQuestion: Question | null = await questionRepo.findOne({
        where: { id: questionId },
      });

      if (!createdQuestion) {
        throw new Error('CreateQuestionUseCase: Не удалось найти вопрос по ID после создания');
      }

      expect(createdQuestion).toBeDefined();
      expect(createdQuestion.body).toBe(dto.body);
      expect(createdQuestion.correctAnswers).toEqual(dto.correctAnswers);
      expect(createdQuestion.status).toBe(QuestionStatus.NotPublished);
      expect(createdQuestion.createdAt).toBeInstanceOf(Date);
      expect(createdQuestion.updatedAt).toBeNull();
    });

    it('должен создать вопрос с минимально допустимой длиной body', async () => {
      const dto: QuestionInputDto = {
        body: 'A'.repeat(bodyConstraints.minLength),
        correctAnswers: ['Answer'],
      };

      const questionId: number = await useCase.execute(new CreateQuestionCommand(dto));

      expect(questionId).toBeDefined();
      expect(typeof questionId).toBe('number');

      const createdQuestion: Question | null = await questionRepo.findOne({
        where: { id: questionId },
      });
      expect(createdQuestion?.body).toBe(dto.body);
      expect(createdQuestion?.body.length).toBe(bodyConstraints.minLength);
    });

    it('должен создать вопрос с максимально допустимой длиной body', async () => {
      const dto: QuestionInputDto = {
        body: 'A'.repeat(bodyConstraints.maxLength),
        correctAnswers: ['Answer'],
      };

      const questionId: number = await useCase.execute(new CreateQuestionCommand(dto));

      expect(questionId).toBeDefined();
      expect(typeof questionId).toBe('number');

      const createdQuestion: Question | null = await questionRepo.findOne({
        where: { id: questionId },
      });
      expect(createdQuestion?.body).toBe(dto.body);
      expect(createdQuestion?.body.length).toBe(bodyConstraints.maxLength);
    });

    it('должен создать вопрос с пустым массивом correctAnswers', async () => {
      const dto: QuestionInputDto = {
        body: 'What is the capital of France?',
        correctAnswers: [],
      };

      const questionId: number = await useCase.execute(new CreateQuestionCommand(dto));

      expect(questionId).toBeDefined();
      expect(typeof questionId).toBe('number');

      const createdQuestion: Question | null = await questionRepo.findOne({
        where: { id: questionId },
      });
      expect(createdQuestion?.correctAnswers).toEqual([]);
      expect(createdQuestion?.status).toBe(QuestionStatus.NotPublished);
    });

    it('должен создать вопрос с correctAnswers минимальной длины элементов', async () => {
      const dto: QuestionInputDto = {
        body: 'What is the shortest answer?',
        correctAnswers: ['A', 'B', 'C'],
      };

      const questionId: number = await useCase.execute(new CreateQuestionCommand(dto));

      expect(questionId).toBeDefined();

      const createdQuestion: Question | null = await questionRepo.findOne({
        where: { id: questionId },
      });
      expect(createdQuestion?.correctAnswers).toEqual(['A', 'B', 'C']);
    });

    it('должен создать вопрос с correctAnswers максимальной длины элементов', async () => {
      const longAnswer: string = 'A'.repeat(correctAnswersConstraints.maxLength);
      const dto: QuestionInputDto = {
        body: 'What is a very long answer?',
        correctAnswers: [longAnswer],
      };

      const questionId: number = await useCase.execute(new CreateQuestionCommand(dto));

      expect(questionId).toBeDefined();

      const createdQuestion: Question | null = await questionRepo.findOne({
        where: { id: questionId },
      });
      expect(createdQuestion?.correctAnswers[0]).toBe(longAnswer);
      expect(createdQuestion?.correctAnswers[0].length).toBe(correctAnswersConstraints.maxLength);
    });

    it('должен создавать уникальные записи с автоинкрементом ID', async () => {
      const dto1: QuestionInputDto = {
        body: 'What is 2+2 equal to?',
        correctAnswers: ['4'],
      };
      const dto2: QuestionInputDto = {
        body: 'What is 3+3 equal to?',
        correctAnswers: ['6'],
      };
      const dto3: QuestionInputDto = {
        body: 'What is 4+4 equal to?',
        correctAnswers: ['8'],
      };

      const [id1, id2, id3] = await Promise.all([
        useCase.execute(new CreateQuestionCommand(dto1)),
        useCase.execute(new CreateQuestionCommand(dto2)),
        useCase.execute(new CreateQuestionCommand(dto3)),
      ]);

      expect(new Set([id1, id2, id3]).size).toBe(3);
      expect(id1).toBeGreaterThan(0);
      expect(id2).toBeGreaterThan(0);
      expect(id3).toBeGreaterThan(0);

      const count: number = await questionRepo.count();
      expect(count).toBe(3);
    });

    it('должен корректно обрабатывать специальные символы в body и correctAnswers', async () => {
      const dto: QuestionInputDto = {
        body: 'What does "console.log(\'Hello\');" output? 🚀 Как дела? @#$%^&*()',
        correctAnswers: ['Hello', '"Hello"', '🚀 Привет!', 'Special: @#$%^&*()'],
      };

      const questionId: number = await useCase.execute(new CreateQuestionCommand(dto));

      expect(questionId).toBeDefined();

      const createdQuestion: Question | null = await questionRepo.findOne({
        where: { id: questionId },
      });
      expect(createdQuestion?.body).toBe(dto.body);
      expect(createdQuestion?.correctAnswers).toEqual(dto.correctAnswers);
    });
  });

  describe('Валидация поля body', () => {
    it('должен отклонять создание вопроса с пустым body', async () => {
      const dto: QuestionInputDto = { body: '', correctAnswers: ['Answer'] };

      await expect(useCase.execute(new CreateQuestionCommand(dto))).rejects.toThrowError();

      const count = await questionRepo.count();
      expect(count).toBe(0);
    });

    it('должен отклонять создание вопроса с body из одних пробелов', async () => {
      const dto: QuestionInputDto = { body: '   \t\n   ', correctAnswers: ['Answer'] };

      await expect(useCase.execute(new CreateQuestionCommand(dto))).rejects.toThrowError();

      const count = await questionRepo.count();
      expect(count).toBe(0);
    });

    it('должен отклонять создание вопроса с body короче минимальной длины', async () => {
      const dto: QuestionInputDto = {
        body: 'A'.repeat(bodyConstraints.minLength - 1),
        correctAnswers: ['Answer'],
      };

      await expect(useCase.execute(new CreateQuestionCommand(dto))).rejects.toThrowError();

      const count = await questionRepo.count();
      expect(count).toBe(0);
    });

    it('должен отклонять создание вопроса с body длиннее максимальной длины', async () => {
      const dto: QuestionInputDto = {
        body: 'A'.repeat(bodyConstraints.maxLength + 1),
        correctAnswers: ['Answer'],
      };

      await expect(useCase.execute(new CreateQuestionCommand(dto))).rejects.toThrowError();

      const count = await questionRepo.count();
      expect(count).toBe(0);
    });

    it('должен отклонять создание вопроса с body неправильного типа', async () => {
      const dto = { body: 12345, correctAnswers: ['Answer'] } as any;

      await expect(useCase.execute(new CreateQuestionCommand(dto))).rejects.toThrowError();
    });
  });

  describe('Валидация поля correctAnswers', () => {
    it('должен отклонять создание вопроса с correctAnswers неправильного типа', async () => {
      const dto = { body: 'Valid question text', correctAnswers: 'not an array' } as any;

      await expect(useCase.execute(new CreateQuestionCommand(dto))).rejects.toThrowError();
    });

    it('должен отклонять создание вопроса с элементом correctAnswers длиннее максимальной длины', async () => {
      const longAnswer = 'A'.repeat(correctAnswersConstraints.maxLength + 1);
      const dto: QuestionInputDto = {
        body: 'Valid question text',
        correctAnswers: [longAnswer],
      };

      await expect(useCase.execute(new CreateQuestionCommand(dto))).rejects.toThrowError();
    });

    it('должен отклонять создание вопроса с пустыми элементами correctAnswers (после trim)', async () => {
      const dto: QuestionInputDto = {
        body: 'Valid question text',
        correctAnswers: ['   ', '\t\n', ''],
      };

      await expect(useCase.execute(new CreateQuestionCommand(dto))).rejects.toThrowError();
    });
  });
});
