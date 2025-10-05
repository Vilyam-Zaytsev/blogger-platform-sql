import { Test, TestingModule } from '@nestjs/testing';
import { CreateUserByAdminUseCase, CreateUserCommand } from './create-user-by-admin.usecase';
import { CoreModule } from '../../../../../core/core.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../domain/entities/user.entity';
import { ConfirmationStatus } from '../../../auth/domain/entities/email-confirmation-code.entity';
import { DataSource, Repository } from 'typeorm';
import { UserValidationService } from '../services/user-validation.service';
import { UsersRepository } from '../../infrastructure/users.repository';
import { UsersFactory } from '../factories/users.factory';
import { CryptoService } from '../services/crypto.service';
import { CreateUserDto } from '../../dto/create-user.dto';
import { DatabaseModule } from '../../../../database/database.module';
import { ValidationException } from '../../../../../core/exceptions/validation-exception';
import { DateService } from '../services/date.service';
import { getRelatedEntities } from '../../../../../core/utils/get-related-entities.utility';
import SpyInstance = jest.SpyInstance;

describe('CreateUserByAdminUseCase (Integration)', () => {
  let module: TestingModule;
  let useCase: CreateUserByAdminUseCase;
  let dataSource: DataSource;
  let repository: Repository<User>;
  let cryptoService: CryptoService;
  let spy: SpyInstance;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DatabaseModule, CoreModule, TypeOrmModule.forFeature(getRelatedEntities(User))],
      providers: [
        CreateUserByAdminUseCase,
        UserValidationService,
        UsersRepository,
        UsersFactory,
        CryptoService,
        DateService,
      ],
    }).compile();

    useCase = module.get<CreateUserByAdminUseCase>(CreateUserByAdminUseCase);
    dataSource = module.get<DataSource>(DataSource);
    cryptoService = module.get<CryptoService>(CryptoService);
    repository = dataSource.getRepository<User>(User);
    spy = jest.spyOn(cryptoService, 'createPasswordHash');
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE TABLE sessions RESTART IDENTITY CASCADE');
    await dataSource.query('TRUNCATE TABLE password_recovery_codes RESTART IDENTITY CASCADE');
    await dataSource.query('TRUNCATE TABLE email_confirmation_codes RESTART IDENTITY CASCADE');
    await dataSource.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
  });

  afterAll(async () => {
    await dataSource.destroy();
    await module.close();
  });

  describe('успешное создание пользователя админом', () => {
    it('должен создать пользователя с подтвержденным email и вернуть ID ', async () => {
      const dto: CreateUserDto = {
        login: 'test_user',
        email: 'test.user@example.com',
        password: 'qwerty',
      };

      const userId: number = await useCase.execute(new CreateUserCommand(dto));

      expect(userId).toBeDefined();
      expect(typeof userId).toBe('number');
      expect(userId).toBeGreaterThan(0);

      const createdUser: User | null = await repository.findOne({
        relations: {
          emailConfirmationCode: true,
        },
        where: { id: userId },
      });

      if (!createdUser) {
        throw new Error(
          'Тест №1: CreateUserByAdminUseCase (Integration): Неудалось найти пользователя по ID после создания',
        );
      }

      expect(createdUser).toBeDefined();
      expect(createdUser.login).toBe(dto.login);
      expect(createdUser.email).toBe(dto.email);
      expect(createdUser.passwordHash).toBeDefined();
      expect(createdUser.passwordHash).not.toBe(dto.password);
      expect(createdUser.passwordHash).toBe(await spy.mock.results[0].value);
      expect(createdUser.createdAt).toBeInstanceOf(Date);
      expect(createdUser.updatedAt).toBeInstanceOf(Date);

      expect(createdUser.emailConfirmationCode).toBeDefined();
      expect(createdUser.emailConfirmationCode.confirmationStatus).toBe(
        ConfirmationStatus.Confirmed,
      );
      expect(createdUser.emailConfirmationCode.confirmationCode).toBeNull();
      expect(createdUser.emailConfirmationCode.expirationDate).toBeNull();
    });

    it('должен создать уникальные хеши паролей для разных пользователей', async () => {
      const dto_1: CreateUserDto = {
        login: 'test_user1',
        email: 'test.user.1@example.com',
        password: 'qwerty',
      };

      const dto_2: CreateUserDto = {
        login: 'test_user2',
        email: 'test.user.2@example.com',
        password: 'qwerty',
      };

      const [userId_1, userId_2] = await Promise.all([
        useCase.execute(new CreateUserCommand(dto_1)),
        useCase.execute(new CreateUserCommand(dto_2)),
      ]);

      const [createdUser_1, createdUser_2] = await Promise.all([
        repository.findOne({
          relations: {
            emailConfirmationCode: true,
          },
          where: { id: userId_1 },
        }),
        repository.findOne({
          relations: {
            emailConfirmationCode: true,
          },
          where: { id: userId_2 },
        }),
      ]);

      if (!createdUser_1 || !createdUser_2) {
        throw new Error(
          'Тест №2: CreateUserByAdminUseCase (Integration): Неудалось найти пользователя по ID после создания',
        );
      }

      expect(createdUser_1.passwordHash).not.toBe(createdUser_2.passwordHash);
    });
  });

  describe('валидация уникальности', () => {
    it('должен выбрасывать ValidationException при дублировании login', async () => {
      const originalDto: CreateUserDto = {
        login: 'test_user1',
        email: 'test.user.1@example.com',
        password: 'qwerty',
      };

      const duplicateLoginDto: CreateUserDto = {
        login: 'test_user1',
        email: 'test.user.2@example.com',
        password: 'qwerty',
      };

      await useCase.execute(new CreateUserCommand(originalDto));

      try {
        await useCase.execute(new CreateUserCommand(duplicateLoginDto));

        fail('Ожидали ValidationException');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationException);
        expect(error.code).toBe('ValidationError');
        expect(error.extensions[0].field).toBe('login');
      }

      const usersCount: number = await repository.count();
      expect(usersCount).toBe(1);
    });

    it('должен выбрасывать ValidationException при дублировании email', async () => {
      const originalDto: CreateUserDto = {
        login: 'test_user1',
        email: 'test.user.1@example.com',
        password: 'qwerty',
      };

      const duplicateEmailDto: CreateUserDto = {
        login: 'test_user2',
        email: 'test.user.1@example.com',
        password: 'qwerty',
      };

      await useCase.execute(new CreateUserCommand(originalDto));

      try {
        await useCase.execute(new CreateUserCommand(duplicateEmailDto));

        fail('Ожидали ValidationException');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationException);
        expect(error.code).toBe('ValidationError');
        expect(error.extensions[0].field).toBe('email');
      }

      const usersCount: number = await repository.count();
      expect(usersCount).toBe(1);
    });

    it('должен выбрасывать ValidationException при одновременном дублировании логина и email', async () => {
      const originalDto: CreateUserDto = {
        login: 'test_user1',
        email: 'test.user.1@example.com',
        password: 'qwerty',
      };

      const duplicateEmailDto: CreateUserDto = {
        login: 'test_user1',
        email: 'test.user.1@example.com',
        password: 'qwerty',
      };

      await useCase.execute(new CreateUserCommand(originalDto));

      try {
        await useCase.execute(new CreateUserCommand(duplicateEmailDto));

        fail('Ожидали ValidationException');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationException);
        expect(error.code).toBe('ValidationError');
        expect(error.extensions[0].field).toBe('login');
      }

      const usersCount: number = await repository.count();
      expect(usersCount).toBe(1);
    });
  });

  describe('валидация логина', () => {
    it('должен корректно обрабатывать граничные значения логина', async () => {
      const minLengthDto: CreateUserDto = {
        login: '123',
        email: '123@example.com',
        password: 'qwerty',
      };

      const userId: number = await useCase.execute(new CreateUserCommand(minLengthDto));
      expect(userId).toBeDefined();

      const maxLengthDto: CreateUserDto = {
        login: '0123456789',
        email: 'max@example.com',
        password: 'qwerty',
      };

      const userId2: number = await useCase.execute(new CreateUserCommand(maxLengthDto));
      expect(userId2).toBeDefined();
    });

    it('должен отклонять создание пользователя при длине логина вне допустимых границ', async () => {
      const shortLoginDto: CreateUserDto = {
        login: '12',
        email: 'shortlogin@example.com',
        password: 'qwerty',
      };
      await expect(useCase.execute(new CreateUserCommand(shortLoginDto))).rejects.toThrowError();

      const longLoginDto: CreateUserDto = {
        login: '012345678901',
        email: 'longlogin@example.com',
        password: 'qwerty',
      };
      await expect(useCase.execute(new CreateUserCommand(longLoginDto))).rejects.toThrowError();
    });
  });

  describe('Валидация email', () => {
    it.each([
      'test@example.com',
      'user.name@mail.co',
      'user-name123@mail.com',
      'user_name@mail-domain.com',
    ])('пропускает валидный email: %s', async (validEmail) => {
      const dto: CreateUserDto = {
        login: 'validlogin',
        email: validEmail,
        password: 'validPass123',
      };

      await expect(useCase.execute(new CreateUserCommand(dto))).resolves.toBeDefined();
    });

    it.each([
      'invalidemail',
      'user@com',
      'user@site.corporate',
      'user@site.',
      '@missinglocalpart.com',
      'user@.missingdomain.com',
      'user@site.c',
      'user@site.toolongdomain',
      'user name@mail.com',
      'user!name@mail.com',
    ])('бросает ошибку при невалидном email: %s', async (invalidEmail) => {
      const dto: CreateUserDto = {
        login: 'validlogin',
        email: invalidEmail,
        password: 'validPass123',
      };

      await expect(useCase.execute(new CreateUserCommand(dto))).rejects.toThrowError();
    });
  });
});
