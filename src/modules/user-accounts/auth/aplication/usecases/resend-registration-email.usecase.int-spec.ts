import { Test, TestingModule } from '@nestjs/testing';
import {
  ResendRegistrationEmailCommand,
  ResendRegistrationEmailUseCase,
} from './resend-registration-email.usecase';
import { DataSource, Repository } from 'typeorm';
import { User } from '../../../users/domain/entities/user.entity';
import { UsersFactory } from '../../../users/application/factories/users.factory';
import { DatabaseModule } from '../../../../database/database.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfirmationStatus } from '../../domain/entities/email-confirmation-code.entity';
import { UserValidationService } from '../../../users/application/services/user-validation.service';
import { UsersRepository } from '../../../users/infrastructure/users.repository';
import { CryptoService } from '../../../users/application/services/crypto.service';
import { DateService } from '../../../users/application/services/date.service';
import { CreateUserDto } from '../../../users/dto/create-user.dto';
import { EventBus } from '@nestjs/cqrs';
import { RegistrationEmailResandingInputDto } from '../../api/input-dto/registration-email-resending.input-dto';
import { UserResendRegisteredEvent } from '../../domain/events/user-resend-registered.event';
import { ValidationException } from '../../../../../core/exceptions/validation-exception';
import { getRelatedEntities } from '../../../../../core/utils/get-related-entities.utility';
import { configModule } from '../../../../../dynamic-config.module';
import { CoreModule } from '../../../../../core/core.module';
import SpyInstance = jest.SpyInstance;

describe('ResendRegistrationEmailUseCase (Integration)', () => {
  let module: TestingModule;
  let useCase: ResendRegistrationEmailUseCase;
  let dataSource: DataSource;
  let usersFactory: UsersFactory;
  let userRepo: Repository<User>;
  let eventBus: EventBus;
  let eventBusSpy: SpyInstance;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        configModule,
        CoreModule,
        DatabaseModule,
        TypeOrmModule.forFeature(getRelatedEntities(User)),
      ],
      providers: [
        ResendRegistrationEmailUseCase,
        UserValidationService,
        UsersFactory,
        UsersRepository,
        CryptoService,
        DateService,
      ],
    })
      .overrideProvider(EventBus)
      .useValue({ publish: jest.fn() })
      .compile();

    useCase = module.get<ResendRegistrationEmailUseCase>(ResendRegistrationEmailUseCase);
    dataSource = module.get<DataSource>(DataSource);
    usersFactory = module.get<UsersFactory>(UsersFactory);
    userRepo = dataSource.getRepository<User>(User);
    eventBus = module.get<EventBus>(EventBus);

    eventBusSpy = eventBus.publish as jest.Mock;
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
    await dataSource.query('TRUNCATE TABLE email_confirmation_codes RESTART IDENTITY CASCADE');
    await dataSource.query('TRUNCATE TABLE password_recovery_codes RESTART IDENTITY CASCADE');
    await dataSource.query('TRUNCATE TABLE sessions RESTART IDENTITY CASCADE');

    eventBusSpy.mockClear();
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
    it('генерирует новый код, сохраняет его и публикует событие', async () => {
      const user: User = await createTestUser('test_user', 'test_user@example.com');
      expect(user.emailConfirmationCode.confirmationCode).toBeDefined();
      expect(user.emailConfirmationCode.confirmationCode).not.toBeNull();
      expect(user.emailConfirmationCode.expirationDate).toBeDefined();
      expect(user.emailConfirmationCode.expirationDate).not.toBeNull();
      expect(user.emailConfirmationCode.confirmationStatus).toBe(ConfirmationStatus.NotConfirmed);

      const dto: RegistrationEmailResandingInputDto = {
        email: user.email,
      };

      await useCase.execute(new ResendRegistrationEmailCommand(dto));

      const userWithUpdatedConfirmationCode: User | null = await userRepo.findOne({
        where: { id: user.id },
        relations: ['emailConfirmationCode'],
      });

      expect(userWithUpdatedConfirmationCode).toBeDefined();
      expect(userWithUpdatedConfirmationCode).not.toBeNull();

      expect(userWithUpdatedConfirmationCode!.emailConfirmationCode.confirmationCode).toBeDefined();
      expect(
        userWithUpdatedConfirmationCode!.emailConfirmationCode.confirmationCode,
      ).not.toBeNull();
      expect(userWithUpdatedConfirmationCode!.emailConfirmationCode.confirmationCode).not.toBe(
        user.emailConfirmationCode.confirmationCode,
      );

      expect(userWithUpdatedConfirmationCode!.emailConfirmationCode.expirationDate).toBeDefined();
      expect(userWithUpdatedConfirmationCode!.emailConfirmationCode.expirationDate).not.toBeNull();
      expect(
        userWithUpdatedConfirmationCode!.emailConfirmationCode.expirationDate!.getTime(),
      ).toBeGreaterThan(user.emailConfirmationCode.expirationDate!.getTime());

      expect(userWithUpdatedConfirmationCode!.emailConfirmationCode.confirmationStatus).toBe(
        ConfirmationStatus.NotConfirmed,
      );

      expect(eventBusSpy).toHaveBeenCalledTimes(1);
      expect(eventBusSpy).toHaveBeenCalledWith(expect.any(UserResendRegisteredEvent));

      const publishedEvent = eventBusSpy.mock.calls[0][0] as UserResendRegisteredEvent;
      expect(publishedEvent.email).toBe(user.email);
      expect(publishedEvent.confirmationCode).toBe(
        userWithUpdatedConfirmationCode!.emailConfirmationCode.confirmationCode,
      );
    });
  });

  describe('Негативные сценарии', () => {
    it('выбрасывает ValidationException если пользователь не найден', async () => {
      const dto: RegistrationEmailResandingInputDto = {
        email: 'non-existing.email@exemple.com',
      };

      try {
        await useCase.execute(new ResendRegistrationEmailCommand(dto));

        fail('Ожидали ValidationException');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationException);
        expect(error.code).toBe('ValidationError');
        expect(error.extensions).toBeDefined();
        expect(error.extensions).toHaveLength(1);
        expect(error.extensions[0].field).toBe('email');
        expect(error.extensions[0].message).toBe(
          `The user with this email address (${dto.email}) was not found`,
        );
      }
    });

    it('выбрасывает ValidationException если email уже Confirmed', async () => {
      const user: User = await createTestUser('test_user', 'test_user@example.com');
      user.confirmEmail();
      await userRepo.save(user);

      const dto: RegistrationEmailResandingInputDto = {
        email: 'test_user@example.com',
      };

      try {
        await useCase.execute(new ResendRegistrationEmailCommand(dto));

        fail('Ожидали ValidationException');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationException);
        expect(error.code).toBe('ValidationError');
        expect(error.extensions).toBeDefined();
        expect(error.extensions).toHaveLength(1);
        expect(error.extensions[0].field).toBe('email');
        expect(error.extensions[0].message).toBe(
          `The email address (${dto.email}) has already been verified`,
        );
      }
    });
  });
});
