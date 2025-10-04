import { Test, TestingModule } from '@nestjs/testing';
import { ConfirmEmailCommand, ConfirmEmailUseCase } from './confirm-email-use.case';
import { DataSource, Repository } from 'typeorm';
import { User } from '../../../users/domain/entities/user.entity';
import { DatabaseModule } from '../../../../database/database.module';
import { CoreModule } from '../../../../../core/core.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfirmationStatus } from '../../domain/entities/email-confirmation-code.entity';
import { UserValidationService } from '../../../users/application/services/user-validation.service';
import { UsersFactory } from '../../../users/application/factories/users.factory';
import { UsersRepository } from '../../../users/infrastructure/users.repository';
import { CryptoService } from '../../../users/application/services/crypto.service';
import { CreateUserDto } from '../../../users/dto/create-user.dto';
import { DateService } from '../../../users/application/services/date.service';
import { RegistrationConfirmationCodeInputDto } from '../../api/input-dto/registration-confirmation-code.input-dto';
import { ValidationException } from '../../../../../core/exceptions/validation-exception';
import { Duration } from 'date-fns';
import { getRelatedEntities } from '../../../../../core/utils/get-related-entities.utility';

describe('ConfirmEmailUseCase (Integration)', () => {
  let module: TestingModule;
  let useCase: ConfirmEmailUseCase;
  let dataSource: DataSource;
  let dateService: DateService;
  let usersFactory: UsersFactory;
  let userRepo: Repository<User>;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DatabaseModule, CoreModule, TypeOrmModule.forFeature(getRelatedEntities(User))],
      providers: [
        ConfirmEmailUseCase,
        UserValidationService,
        UsersFactory,
        UsersRepository,
        CryptoService,
        DateService,
      ],
    }).compile();

    useCase = module.get<ConfirmEmailUseCase>(ConfirmEmailUseCase);
    dataSource = module.get<DataSource>(DataSource);
    dateService = module.get<DateService>(DateService);
    usersFactory = module.get<UsersFactory>(UsersFactory);
    userRepo = dataSource.getRepository<User>(User);
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
    await dataSource.query('TRUNCATE TABLE email_confirmation_codes RESTART IDENTITY CASCADE');
    await dataSource.query('TRUNCATE TABLE password_recovery_codes RESTART IDENTITY CASCADE');
    await dataSource.query('TRUNCATE TABLE sessions RESTART IDENTITY CASCADE');
  });

  afterAll(async () => {
    await dataSource.destroy();
    await module.close();
  });

  async function createTestUser(login: string, email: string): Promise<User> {
    const dto: CreateUserDto = {
      login,
      email,
      password: 'qwerty',
    };

    const user: User = await usersFactory.create(dto);
    return await userRepo.save(user);
  }

  describe('Позитивный сценарий', () => {
    it('успешно подтверждает email и меняет статус на Confirmed', async () => {
      const notConfirmedUser: User = await createTestUser('test_user', 'test_user@example.com');
      expect(notConfirmedUser.emailConfirmationCode.confirmationCode).toBeDefined();
      expect(notConfirmedUser.emailConfirmationCode.confirmationCode).not.toBeNull();
      expect(notConfirmedUser.emailConfirmationCode.expirationDate).toBeDefined();
      expect(notConfirmedUser.emailConfirmationCode.expirationDate).not.toBeNull();
      expect(notConfirmedUser.emailConfirmationCode.confirmationStatus).toBe(
        ConfirmationStatus.NotConfirmed,
      );

      const dto: RegistrationConfirmationCodeInputDto = {
        code: notConfirmedUser.emailConfirmationCode.confirmationCode!,
      };

      await useCase.execute(new ConfirmEmailCommand(dto));

      const confirmedUser: User | null = await userRepo.findOne({
        where: { id: notConfirmedUser.id },
        relations: ['emailConfirmationCode'],
      });

      expect(confirmedUser).toBeDefined();
      expect(confirmedUser).not.toBeNull();

      expect(confirmedUser!.emailConfirmationCode.confirmationCode).toBeNull();
      expect(confirmedUser!.emailConfirmationCode.expirationDate).toBeNull();
      expect(confirmedUser!.emailConfirmationCode.confirmationStatus).toBe(
        ConfirmationStatus.Confirmed,
      );
    });
  });

  describe('Негативные сценарии', () => {
    it('выбрасывает ValidationException при неверном коде', async () => {
      const dto: RegistrationConfirmationCodeInputDto = {
        code: 'not_existing_code',
      };

      try {
        await useCase.execute(new ConfirmEmailCommand(dto));

        fail('Ожидали ValidationException');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationException);
        expect(error.code).toBe('ValidationError');
        expect(error.extensions).toBeDefined();
        expect(error.extensions).toHaveLength(1);
        expect(error.extensions[0].field).toBe('code');
        expect(error.extensions[0].message).toBe(
          `Confirmation code (${dto.code}) incorrect or the email address has already been confirmed.`,
        );
      }
    });

    it('выбрасывает ValidationException при просроченном коде', async () => {
      const originalMethod = dateService.generateExpirationDate.bind(dateService) as (
        expirationOffset: Duration,
        fromDate?: Date,
      ) => Date;

      const spy = jest.spyOn(dateService, 'generateExpirationDate').mockImplementation(function (
        expirationOffset: Duration,
        fromDate?: Date,
      ): Date {
        return originalMethod.call(dateService, { hours: -2 }, fromDate) as Date;
      });

      const user: User = await createTestUser('test_user', 'test_user@example.com');
      expect(user.emailConfirmationCode.confirmationCode).toBeDefined();
      expect(user.emailConfirmationCode.confirmationCode).not.toBeNull();
      expect(user.emailConfirmationCode.expirationDate).toBeDefined();
      expect(user.emailConfirmationCode.expirationDate).not.toBeNull();
      expect(user.emailConfirmationCode.expirationDate!.getTime()).toBeLessThan(Date.now());
      expect(user.emailConfirmationCode.confirmationStatus).toBe(ConfirmationStatus.NotConfirmed);

      const dto: RegistrationConfirmationCodeInputDto = {
        code: user.emailConfirmationCode.confirmationCode!,
      };

      try {
        await useCase.execute(new ConfirmEmailCommand(dto));

        fail('Ожидали ValidationException');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationException);
        expect(error.code).toBe('ValidationError');
        expect(error.extensions).toBeDefined();
        expect(error.extensions).toHaveLength(1);
        expect(error.extensions[0].field).toBe('code');
        expect(error.extensions[0].message).toBe(
          'Email confirmation code has expired. Please request a new confirmation code.',
        );
      }

      spy.mockClear();
      spy.mockRestore();
    });

    it('выбрасывает ValidationException при отсутствии active code', async () => {
      const user: User = await createTestUser('test_user', 'test_user@example.com');
      user.emailConfirmationCode.expirationDate = null;
      await userRepo.save(user);

      const dto: RegistrationConfirmationCodeInputDto = {
        code: user.emailConfirmationCode.confirmationCode!,
      };

      try {
        await useCase.execute(new ConfirmEmailCommand(dto));

        fail('Ожидали ValidationException');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationException);
        expect(error.code).toBe('ValidationError');
        expect(error.extensions).toBeDefined();
        expect(error.extensions).toHaveLength(1);
        expect(error.extensions[0].field).toBe('code');
        expect(error.extensions[0].message).toBe(
          'No active confirmation code found. Please request a new confirmation code.',
        );
      }
    });

    it('выбрасывает ValidationException если email уже Confirmed', async () => {
      const user: User = await createTestUser('test_user', 'test_user@example.com');
      user.emailConfirmationCode.confirmationStatus = ConfirmationStatus.Confirmed;
      await userRepo.save(user);

      const dto: RegistrationConfirmationCodeInputDto = {
        code: user.emailConfirmationCode.confirmationCode!,
      };

      try {
        await useCase.execute(new ConfirmEmailCommand(dto));

        fail('Ожидали ValidationException');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationException);
        expect(error.code).toBe('ValidationError');
        expect(error.extensions).toBeDefined();
        expect(error.extensions).toHaveLength(1);
        expect(error.extensions[0].field).toBe('code');
        expect(error.extensions[0].message).toBe('Email address has already been confirmed.');
      }
    });
  });
});
