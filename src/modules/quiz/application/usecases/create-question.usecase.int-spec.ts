import { Test, TestingModule } from '@nestjs/testing';
import { CreateQuestionCommand, CreateQuestionUseCase } from './create-question.usecase';
import { DataSource, Repository } from 'typeorm';
import { bodyConstraints, Question, QuestionStatus } from '../../domain/entities/question.entity';
import { DatabaseModule } from '../../../database/database.module';
import { CoreModule } from '../../../../core/core.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getRelatedEntities } from '../../../../core/utils/get-related-entities.utility';
import { QuestionRepository } from '../../infrastructure/question.repository';
import { QuestionInputDto } from '../../api/input-dto/question.input-dto';
import { configModule } from '../../../../dynamic-config.module';

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
      providers: [CreateQuestionUseCase, QuestionRepository],
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

  describe('успешное создание вопроса', () => {
    it('должен создать вопрос с валидными данными и вернуть ID', async () => {
      const dto: QuestionInputDto = {
        body: 'What is the capital of France?',
        correctAnswers: ['Paris'],
      };

      const questionId: number = await useCase.execute(new CreateQuestionCommand(dto));

      expect(questionId).toBeDefined();
      expect(typeof questionId).toBe('number');
      expect(questionId).toBeGreaterThan(0);

      const createdQuestion = await questionRepo.findOne({
        where: { id: questionId },
      });

      if (!createdQuestion) {
        throw new Error(
          'Тест №1: CreateQuestionUseCase (Integration): Не удалось найти вопрос по ID после создания',
        );
      }
      console.log(createdQuestion);
      expect(createdQuestion).toBeDefined();
      expect(createdQuestion.body).toBe(dto.body);
      expect(createdQuestion.correctAnswers).toEqual(dto.correctAnswers);
      expect(createdQuestion.status).toBe(QuestionStatus.Draft);
      expect(createdQuestion.createdAt).toBeInstanceOf(Date);
      expect(createdQuestion.updatedAt).toBeInstanceOf(Date);
    });

    it('должен создавать уникальные записи для каждого вызова', async () => {
      const dto1: QuestionInputDto = {
        body: 'What is 2+2 equal to?',
        correctAnswers: ['4'],
      };
      const dto2: QuestionInputDto = {
        body: 'What is 3+3 equal to?',
        correctAnswers: ['6'],
      };

      const [id1, id2] = await Promise.all([
        useCase.execute(new CreateQuestionCommand(dto1)),
        useCase.execute(new CreateQuestionCommand(dto2)),
      ]);

      expect(id1).not.toBe(id2);

      const count: number = await questionRepo.count();
      expect(count).toBe(2);
    });
  });

  describe('валидация поля body', () => {
    it('должен отклонять создание вопроса с пустым body', async () => {
      const dto: QuestionInputDto = { body: '', correctAnswers: ['Answer'] };
      await expect(useCase.execute(new CreateQuestionCommand(dto))).rejects.toThrowError();
    });

    it('должен отклонять создание вопроса с body короче минимальной длины', async () => {
      const dto: QuestionInputDto = {
        body: 'A'.repeat(bodyConstraints.minLength - 1),
        correctAnswers: ['Answer'],
      };
      await expect(useCase.execute(new CreateQuestionCommand(dto))).rejects.toThrowError();
    });

    it('должен отклонять создание вопроса с body длиннее максимальной длины', async () => {
      const dto: QuestionInputDto = {
        body: 'A'.repeat(bodyConstraints.maxLength + 1),
        correctAnswers: ['Answer'],
      };
      await expect(useCase.execute(new CreateQuestionCommand(dto))).rejects.toThrowError();
    });
  });

  describe('валидация поля correctAnswers', () => {
    it('должен отклонять создание вопроса с пустым массивом correctAnswers', async () => {
      const dto: QuestionInputDto = { body: 'Valid question text', correctAnswers: [] };
      await expect(useCase.execute(new CreateQuestionCommand(dto))).rejects.toThrowError();
    });

    it('должен отклонять создание вопроса с элементом массива длиннее максимальной длины', async () => {
      const long: string = 'A'.repeat(bodyConstraints.maxLength + 1);
      const dto: QuestionInputDto = { body: 'Valid question text', correctAnswers: [long] };
      await expect(useCase.execute(new CreateQuestionCommand(dto))).rejects.toThrowError();
    });
  });

  describe('граничные случаи', () => {
    it('должен обрабатывать undefined поля в DTO', async () => {
      const dto = { body: undefined, correctAnswers: undefined } as any;
      await expect(useCase.execute(new CreateQuestionCommand(dto))).rejects.toThrowError();
    });

    it('должен обрабатывать null поля в DTO', async () => {
      const dto = { body: null, correctAnswers: null } as any;
      await expect(useCase.execute(new CreateQuestionCommand(dto))).rejects.toThrowError();
    });
  });
});
