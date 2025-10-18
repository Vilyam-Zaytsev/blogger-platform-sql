import { DataSource, Repository } from 'typeorm';
import {
  Question,
  QuestionStatus,
  bodyConstraints,
  correctAnswersConstraints,
} from '../../domain/entities/question.entity';
import { UpdateQuestionCommand, UpdateQuestionUseCase } from './update-question.usecase';
import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseModule } from '../../../database/database.module';
import { CoreModule } from '../../../../core/core.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuestionsRepository } from '../../infrastructure/questions-repository';
import { QuestionUpdateDto } from '../dto/question.update-dto';
import { QuestionInputDto } from '../../api/input-dto/question.input-dto';
import { getRelatedEntities } from '../../../../core/utils/get-related-entities.utility';
import { configModule } from '../../../../dynamic-config.module';
import { DomainException } from '../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../core/exceptions/domain-exception-codes';

describe('UpdateQuestionUseCase (Integration)', () => {
  let module: TestingModule;
  let useCase: UpdateQuestionUseCase;
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
      providers: [UpdateQuestionUseCase, QuestionsRepository],
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

  const createQuestion = async (dto: QuestionInputDto): Promise<Question> => {
    const question: Question = Question.create(dto);
    await questionRepo.save(question);
    return question;
  };

  describe('успешное обновление вопроса', () => {
    it('должен обновить вопрос с валидными данными', async () => {
      const initialDto: QuestionInputDto = {
        body: 'What is the capital of France?',
        correctAnswers: ['Paris'],
      };
      const { id, updatedAt }: Question = await createQuestion(initialDto);

      const updateDto: QuestionUpdateDto = {
        id,
        body: 'What is the capital of Germany?',
        correctAnswers: ['Berlin'],
      };

      await useCase.execute(new UpdateQuestionCommand(updateDto));

      const updatedQuestion: Question | null = await questionRepo.findOne({
        where: { id },
      });

      if (!updatedQuestion) {
        throw new Error(
          'Тест №1: UpdateQuestionUseCase (Integration): Не удалось найти вопрос по ID после обновления',
        );
      }

      expect(updatedQuestion.body).toBe(updateDto.body);
      expect(updatedQuestion.correctAnswers).toEqual(updateDto.correctAnswers);
      expect(updatedQuestion.updatedAt.getTime()).toBeGreaterThan(updatedAt.getTime());
    });

    it('должен обновить только body, оставив correctAnswers без изменений', async () => {
      const initialDto: QuestionInputDto = {
        body: 'What is 2+2?',
        correctAnswers: ['4', 'four'],
      };
      const { id, correctAnswers }: Question = await createQuestion(initialDto);

      const updateDto: QuestionUpdateDto = {
        id,
        body: 'What is the result of 2+2?',
        correctAnswers,
      };

      await useCase.execute(new UpdateQuestionCommand(updateDto));

      const updatedQuestion: Question | null = await questionRepo.findOne({
        where: { id },
      });

      expect(updatedQuestion?.body).toBe(updateDto.body);
      expect(updatedQuestion?.correctAnswers).toEqual(initialDto.correctAnswers);
    });

    it('должен обновить только correctAnswers, оставив body без изменений', async () => {
      const initialDto: QuestionInputDto = {
        body: 'Name primary colors',
        correctAnswers: ['Red'],
      };
      const { id, body }: Question = await createQuestion(initialDto);

      const updateDto: QuestionUpdateDto = {
        id,
        body,
        correctAnswers: ['Red', 'Blue', 'Yellow'],
      };

      await useCase.execute(new UpdateQuestionCommand(updateDto));

      const updatedQuestion: Question | null = await questionRepo.findOne({
        where: { id },
      });

      expect(updatedQuestion?.body).toBe(initialDto.body);
      expect(updatedQuestion?.correctAnswers).toEqual(updateDto.correctAnswers);
    });

    it('должен обновить вопрос со статусом Draft', async () => {
      const initialDto: QuestionInputDto = {
        body: 'What is Node.js?',
        correctAnswers: ['Runtime'],
      };
      const { id, status }: Question = await createQuestion(initialDto);

      expect(status).toBe(QuestionStatus.Draft);

      const updateDto: QuestionUpdateDto = {
        id,
        body: 'What is Node.js runtime?',
        correctAnswers: ['JavaScript runtime'],
      };

      await useCase.execute(new UpdateQuestionCommand(updateDto));

      const updatedQuestion: Question | null = await questionRepo.findOne({
        where: { id },
      });

      expect(updatedQuestion?.body).toBe(updateDto.body);
      expect(updatedQuestion?.status).toBe(QuestionStatus.Draft);
    });

    it('должен обновить вопрос со статусом Published', async () => {
      const initialDto: QuestionInputDto = {
        body: 'What is TypeScript?',
        correctAnswers: ['Superset of JavaScript'],
      };
      const createdQuestion: Question = await createQuestion(initialDto);

      createdQuestion.status = QuestionStatus.Published;
      await questionRepo.save(createdQuestion);

      const updateDto: QuestionUpdateDto = {
        id: createdQuestion.id,
        body: 'What is TypeScript language?',
        correctAnswers: ['Typed JavaScript'],
      };

      await useCase.execute(new UpdateQuestionCommand(updateDto));

      const updatedQuestion: Question | null = await questionRepo.findOne({
        where: { id: createdQuestion.id },
      });

      expect(updatedQuestion?.body).toBe(updateDto.body);
      expect(updatedQuestion?.correctAnswers).toEqual(updateDto.correctAnswers);
      expect(updatedQuestion?.status).toBe(QuestionStatus.Published);
    });

    it('должен корректно обновить вопрос с граничными значениями body', async () => {
      const initialDto: QuestionInputDto = {
        body: 'A'.repeat(bodyConstraints.minLength),
        correctAnswers: ['Answer'],
      };
      const { id }: Question = await createQuestion(initialDto);

      const updateDto: QuestionUpdateDto = {
        id,
        body: 'B'.repeat(bodyConstraints.maxLength),
        correctAnswers: ['Answer'],
      };

      await useCase.execute(new UpdateQuestionCommand(updateDto));

      const updatedQuestion: Question | null = await questionRepo.findOne({
        where: { id },
      });

      expect(updatedQuestion?.body).toBe(updateDto.body);
      expect(updatedQuestion?.body.length).toBe(bodyConstraints.maxLength);
    });

    it('должен корректно обновить вопрос с граничными значениями correctAnswers', async () => {
      const initialDto: QuestionInputDto = {
        body: 'Initial question',
        correctAnswers: ['A'],
      };
      const { id }: Question = await createQuestion(initialDto);

      const minAnswer: string = 'X'.repeat(correctAnswersConstraints.minLength);
      const maxAnswer: string = 'Y'.repeat(correctAnswersConstraints.maxLength);

      const updateDto: QuestionUpdateDto = {
        id,
        body: 'Updated question',
        correctAnswers: [minAnswer, maxAnswer],
      };

      await useCase.execute(new UpdateQuestionCommand(updateDto));

      const updatedQuestion: Question | null = await questionRepo.findOne({
        where: { id },
      });

      expect(updatedQuestion?.correctAnswers).toEqual([minAnswer, maxAnswer]);
      expect(updatedQuestion?.correctAnswers[0].length).toBe(correctAnswersConstraints.minLength);
      expect(updatedQuestion?.correctAnswers[1].length).toBe(correctAnswersConstraints.maxLength);
    });

    it('должен обновить поле updatedAt после изменения', async () => {
      const initialDto: QuestionInputDto = {
        body: 'Original question',
        correctAnswers: ['Answer'],
      };
      const { id, updatedAt: originalUpdatedAt }: Question = await createQuestion(initialDto);

      await new Promise((resolve) => setTimeout(resolve, 10));

      const updateDto: QuestionUpdateDto = {
        id,
        body: 'Modified question',
        correctAnswers: ['Answer'],
      };

      await useCase.execute(new UpdateQuestionCommand(updateDto));

      const updatedQuestion: Question | null = await questionRepo.findOne({
        where: { id },
      });

      expect(updatedQuestion?.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });

    it('должен сохранить поле createdAt без изменений при обновлении', async () => {
      const initialDto: QuestionInputDto = {
        body: 'Question for timestamp test',
        correctAnswers: ['Answer'],
      };
      const { id, createdAt: originalCreatedAt } = await createQuestion(initialDto);

      const updateDto: QuestionUpdateDto = {
        id,
        body: 'Updated timestamp test',
        correctAnswers: ['New answer'],
      };

      await useCase.execute(new UpdateQuestionCommand(updateDto));

      const updatedQuestion: Question | null = await questionRepo.findOne({
        where: { id },
      });

      expect(updatedQuestion?.createdAt.getTime()).toBe(originalCreatedAt.getTime());
    });
  });

  describe('обработка несуществующего вопроса', () => {
    it('должен выбросить DomainException с кодом NotFound для несуществующего ID', async () => {
      const nonExistentId = 99999;
      const updateDto: QuestionUpdateDto = {
        id: nonExistentId,
        body: 'Some question text',
        correctAnswers: ['Answer'],
      };

      await expect(useCase.execute(new UpdateQuestionCommand(updateDto))).rejects.toThrow(
        DomainException,
      );

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

    it('должен выбросить DomainException для удалённого вопроса', async () => {
      const initialDto: QuestionInputDto = {
        body: 'Question to be deleted',
        correctAnswers: ['Answer'],
      };
      const { id }: Question = await createQuestion(initialDto);

      await questionRepo.softDelete(id);

      const updateDto: QuestionUpdateDto = {
        id,
        body: 'Trying to update deleted question',
        correctAnswers: ['Answer'],
      };

      await expect(useCase.execute(new UpdateQuestionCommand(updateDto))).rejects.toThrow(
        DomainException,
      );
    });
  });

  describe('валидация поля body при обновлении', () => {
    it('должен отклонять обновление с пустым body', async () => {
      const initialDto: QuestionInputDto = {
        body: 'Valid initial question',
        correctAnswers: ['Answer'],
      };
      const { id }: Question = await createQuestion(initialDto);

      const updateDto: QuestionUpdateDto = {
        id,
        body: '',
        correctAnswers: ['Answer'],
      };

      await expect(useCase.execute(new UpdateQuestionCommand(updateDto))).rejects.toThrowError();
    });

    it('должен отклонять обновление с body короче минимальной длины', async () => {
      const initialDto: QuestionInputDto = {
        body: 'Valid initial question',
        correctAnswers: ['Answer'],
      };
      const { id }: Question = await createQuestion(initialDto);

      const updateDto: QuestionUpdateDto = {
        id,
        body: 'A'.repeat(bodyConstraints.minLength - 1),
        correctAnswers: ['Answer'],
      };

      await expect(useCase.execute(new UpdateQuestionCommand(updateDto))).rejects.toThrowError();
    });

    it('должен отклонять обновление с body длиннее максимальной длины', async () => {
      const initialDto: QuestionInputDto = {
        body: 'Valid initial question',
        correctAnswers: ['Answer'],
      };
      const { id }: Question = await createQuestion(initialDto);

      const updateDto: QuestionUpdateDto = {
        id,
        body: 'A'.repeat(bodyConstraints.maxLength + 1),
        correctAnswers: ['Answer'],
      };

      await expect(useCase.execute(new UpdateQuestionCommand(updateDto))).rejects.toThrowError();
    });
  });

  describe('валидация поля correctAnswers при обновлении', () => {
    it('должен отклонять обновление с пустым массивом correctAnswers', async () => {
      const initialDto: QuestionInputDto = {
        body: 'Valid initial question',
        correctAnswers: ['Answer'],
      };
      const { id }: Question = await createQuestion(initialDto);

      const updateDto: QuestionUpdateDto = {
        id,
        body: 'Valid question text',
        correctAnswers: [],
      };

      await expect(useCase.execute(new UpdateQuestionCommand(updateDto))).rejects.toThrowError();
    });

    it('должен отклонять обновление с элементом массива короче минимальной длины', async () => {
      const initialDto: QuestionInputDto = {
        body: 'Valid initial question',
        correctAnswers: ['Answer'],
      };
      const { id }: Question = await createQuestion(initialDto);

      const tooShort: string = 'A'.repeat(correctAnswersConstraints.minLength - 1);
      const updateDto: QuestionUpdateDto = {
        id,
        body: 'Valid question text',
        correctAnswers: [tooShort],
      };

      await expect(useCase.execute(new UpdateQuestionCommand(updateDto))).rejects.toThrowError();
    });

    it('должен отклонять обновление с элементом массива длиннее максимальной длины', async () => {
      const initialDto: QuestionInputDto = {
        body: 'Valid initial question',
        correctAnswers: ['Answer'],
      };
      const { id }: Question = await createQuestion(initialDto);

      const tooLong: string = 'A'.repeat(correctAnswersConstraints.maxLength + 1);
      const updateDto: QuestionUpdateDto = {
        id,
        body: 'Valid question text',
        correctAnswers: [tooLong],
      };

      await expect(useCase.execute(new UpdateQuestionCommand(updateDto))).rejects.toThrowError();
    });

    //TODO: исправить функцию в постгрес(пропускает массив строк из пробелов)

    // it('должен отклонять обновление с элементами только из пробелов', async () => {
    //   const initialDto: QuestionInputDto = {
    //     body: 'Valid initial question',
    //     correctAnswers: ['Answer'],
    //   };
    //   const { id }: Question = await createQuestion(initialDto);
    //
    //   const onlySpaces: string = ' '.repeat(correctAnswersConstraints.minLength + 5);
    //   const updateDto: QuestionUpdateDto = {
    //     id,
    //     body: 'Valid question text',
    //     correctAnswers: [onlySpaces],
    //   };
    //
    //   await expect(useCase.execute(new UpdateQuestionCommand(updateDto))).rejects.toThrowError();
    // });
  });

  describe('конкурентное обновление', () => {
    it('должен корректно обрабатывать последовательные обновления одного вопроса', async () => {
      const initialDto: QuestionInputDto = {
        body: 'Initial question',
        correctAnswers: ['Answer 1'],
      };
      const { id }: Question = await createQuestion(initialDto);

      const updateDto1: QuestionUpdateDto = {
        id,
        body: 'First update',
        correctAnswers: ['Answer 2'],
      };

      const updateDto2: QuestionUpdateDto = {
        id,
        body: 'Second update',
        correctAnswers: ['Answer 3'],
      };

      await useCase.execute(new UpdateQuestionCommand(updateDto1));
      await useCase.execute(new UpdateQuestionCommand(updateDto2));

      const finalQuestion: Question | null = await questionRepo.findOne({
        where: { id },
      });

      expect(finalQuestion?.body).toBe(updateDto2.body);
      expect(finalQuestion?.correctAnswers).toEqual(updateDto2.correctAnswers);
    });

    it('должен корректно обрабатывать параллельные обновления разных вопросов', async () => {
      const dto1: QuestionInputDto = {
        body: 'Question 1',
        correctAnswers: ['Answer 1'],
      };
      const dto2: QuestionInputDto = {
        body: 'Question 2',
        correctAnswers: ['Answer 2'],
      };

      const [question1, question2] = await Promise.all([
        createQuestion(dto1),
        createQuestion(dto2),
      ]);

      const updateDto1: QuestionUpdateDto = {
        id: question1.id,
        body: 'Updated Question 1',
        correctAnswers: ['Updated Answer 1'],
      };

      const updateDto2: QuestionUpdateDto = {
        id: question2.id,
        body: 'Updated Question 2',
        correctAnswers: ['Updated Answer 2'],
      };

      await Promise.all([
        useCase.execute(new UpdateQuestionCommand(updateDto1)),
        useCase.execute(new UpdateQuestionCommand(updateDto2)),
      ]);

      const [updated1, updated2] = await Promise.all([
        questionRepo.findOne({ where: { id: question1.id } }),
        questionRepo.findOne({ where: { id: question2.id } }),
      ]);

      expect(updated1?.body).toBe(updateDto1.body);
      expect(updated2?.body).toBe(updateDto2.body);
    });
  });

  describe('граничные случаи', () => {
    it('должен обрабатывать специальные символы в body', async () => {
      const initialDto: QuestionInputDto = {
        body: 'Normal question text',
        correctAnswers: ['Answer'],
      };
      const { id }: Question = await createQuestion(initialDto);

      const updateDto: QuestionUpdateDto = {
        id,
        body: 'Question with special chars: @#$%^&*()',
        correctAnswers: ['Answer'],
      };

      await useCase.execute(new UpdateQuestionCommand(updateDto));

      const updatedQuestion = await questionRepo.findOne({
        where: { id },
      });

      expect(updatedQuestion?.body).toBe(updateDto.body);
    });

    it('должен обрабатывать Unicode символы в body', async () => {
      const initialDto: QuestionInputDto = {
        body: 'Normal question',
        correctAnswers: ['Answer'],
      };
      const { id }: Question = await createQuestion(initialDto);

      const updateDto: QuestionUpdateDto = {
        id,
        body: 'Вопрос на русском языке с эмодзи 🚀',
        correctAnswers: ['Ответ'],
      };

      await useCase.execute(new UpdateQuestionCommand(updateDto));

      const updatedQuestion = await questionRepo.findOne({
        where: { id },
      });

      expect(updatedQuestion?.body).toBe(updateDto.body);
      expect(updatedQuestion?.correctAnswers).toEqual(updateDto.correctAnswers);
    });

    it('должен обрабатывать множественные правильные ответы', async () => {
      const initialDto: QuestionInputDto = {
        body: 'Name programming languages',
        correctAnswers: ['JavaScript'],
      };
      const { id }: Question = await createQuestion(initialDto);

      const updateDto: QuestionUpdateDto = {
        id,
        body: 'Name programming languages',
        correctAnswers: ['JavaScript', 'TypeScript', 'Python', 'Java', 'C++'],
      };

      await useCase.execute(new UpdateQuestionCommand(updateDto));

      const updatedQuestion = await questionRepo.findOne({
        where: { id },
      });

      expect(updatedQuestion?.correctAnswers).toHaveLength(5);
      expect(updatedQuestion?.correctAnswers).toEqual(updateDto.correctAnswers);
    });
  });
});
