import { Test, TestingModule } from '@nestjs/testing';
import { RegisterUserCommand, RegisterUserUseCase } from './register-user.useсase';
import { DataSource, Repository } from 'typeorm';
import { User } from '../../../users/domain/entities/user.entity';
import { UserInputDto } from '../../../users/api/input-dto/user.input-dto';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ConfirmationStatus,
  EmailConfirmationCode,
} from '../../domain/entities/email-confirmation-code.entity';
import { PasswordRecoveryCode } from '../../domain/entities/password-recovery-code.entity';
import { Session } from '../../../sessions/domain/entities/session.entity';
import { UserValidationService } from '../../../users/application/services/user-validation.service';
import { UsersFactory } from '../../../users/application/factories/users.factory';
import { UsersRepository } from '../../../users/infrastructure/users.repository';
import { CryptoService } from '../../../users/application/services/crypto.service';
import { DatabaseModule } from '../../../../database/database.module';
import { CoreModule } from '../../../../../core/core.module';
import { NotificationsModule } from '../../../../notifications/notifications.module';
import { EventBus } from '@nestjs/cqrs';
import { UserRegisteredEvent } from '../../domain/events/user-registered.event';
import { ValidationException } from '../../../../../core/exceptions/validation-exception';
import SpyInstance = jest.SpyInstance;

describe('RegisterUserUseCase (Integration)', () => {
  let module: TestingModule;
  let useCase: RegisterUserUseCase;
  let dataSource: DataSource;
  let userRepo: Repository<User>;
  let eventBus: EventBus;
  let eventBusSpy: SpyInstance;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        DatabaseModule,
        CoreModule,
        NotificationsModule,
        TypeOrmModule.forFeature([User, EmailConfirmationCode, PasswordRecoveryCode, Session]),
      ],
      providers: [
        RegisterUserUseCase,
        UserValidationService,
        UsersFactory,
        UsersRepository,
        CryptoService,
      ],
    })
      .overrideProvider(EventBus)
      .useValue({ publish: jest.fn() })
      .compile();

    useCase = module.get<RegisterUserUseCase>(RegisterUserUseCase);
    dataSource = module.get<DataSource>(DataSource);
    userRepo = dataSource.getRepository<User>(User);
    eventBus = module.get<EventBus>(EventBus);

    eventBusSpy = eventBus.publish as jest.Mock;
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE TABLE sessions RESTART IDENTITY CASCADE');
    await dataSource.query('TRUNCATE TABLE password_recovery_codes RESTART IDENTITY CASCADE');
    await dataSource.query('TRUNCATE TABLE email_confirmation_codes RESTART IDENTITY CASCADE');
    await dataSource.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');

    eventBusSpy.mockClear();
  });

  afterAll(async () => {
    await dataSource.destroy();
    await module.close();
  });

  describe('успешная регистрация пользователя', () => {
    it('должен создать пользователя с кодом подтверждения и опубликовать событие', async () => {
      const dto: UserInputDto = {
        login: 'test_user',
        email: 'test_user@example.com',
        password: 'qwerty',
      };

      await useCase.execute(new RegisterUserCommand(dto));

      const users: User[] = await userRepo.find({
        relations: ['emailConfirmationCode'],
        where: { login: dto.login },
      });

      expect(users).toHaveLength(1);
      const user: User = users[0];

      expect(user.login).toBe(dto.login);
      expect(user.email).toBe(dto.email);
      expect(user.passwordHash).toBeDefined();
      expect(user.passwordHash).not.toBe(dto.password);

      expect(user.emailConfirmationCode).toBeDefined();
      expect(user.emailConfirmationCode.confirmationCode).toBeDefined();
      expect(user.emailConfirmationCode.confirmationCode).not.toBeNull();
      expect(user.emailConfirmationCode.expirationDate).toBeDefined();
      expect(user.emailConfirmationCode.confirmationStatus).toBe(ConfirmationStatus.NotConfirmed);

      expect(eventBusSpy).toHaveBeenCalledTimes(1);
      expect(eventBusSpy).toHaveBeenCalledWith(expect.any(UserRegisteredEvent));

      const publishedEvent = eventBusSpy.mock.calls[0][0] as UserRegisteredEvent;
      expect(publishedEvent.email).toBe(dto.email);
      expect(publishedEvent.confirmationCode).toBe(user.emailConfirmationCode.confirmationCode);
    });

    it('должен создать пользователя с корректными временными метками', async () => {
      const dto: UserInputDto = {
        login: 'test_user',
        email: 'test_user@example.com',
        password: 'qwerty',
      };

      const before: number = Date.now();

      await useCase.execute(new RegisterUserCommand(dto));

      const after: number = Date.now();

      const user: User | null = await userRepo.findOne({
        relations: ['emailConfirmationCode'],
        where: { login: dto.login },
      });

      expect(user).toBeDefined();
      expect(user).not.toBeNull();
      expect(user!.createdAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(user!.createdAt.getTime()).toBeLessThanOrEqual(after);
      expect(user!.updatedAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(user!.updatedAt.getTime()).toBeLessThanOrEqual(after);

      expect(user!.emailConfirmationCode).toBeDefined();
      expect(user!.emailConfirmationCode.expirationDate).not.toBeNull();
      expect(user!.emailConfirmationCode.expirationDate!.getTime()).toBeGreaterThan(after);
    });

    it('должен генерировать уникальные коды подтверждения для разных пользователей', async () => {
      const dto1: UserInputDto = {
        login: 'test_user1',
        email: 'test_user1@example.com',
        password: 'qwerty',
      };

      const dto2: UserInputDto = {
        login: 'test_user2',
        email: 'test_user2@example.com',
        password: 'qwerty',
      };

      await useCase.execute(new RegisterUserCommand(dto1));
      await useCase.execute(new RegisterUserCommand(dto2));

      const users: User[] = await userRepo.find({
        relations: ['emailConfirmationCode'],
      });

      expect(users).toHaveLength(2);

      const codes = users.map((u) => u.emailConfirmationCode.confirmationCode);
      expect(codes[0]).not.toBe(codes[1]);
      expect(new Set(codes).size).toBe(2);

      expect(eventBusSpy).toHaveBeenCalledTimes(2);
    });

    it('должен корректно хешировать различные пароли', async () => {
      const users = [
        { login: 'user1', email: 'user1@example.com', password: 'password123' },
        { login: 'user2', email: 'user2@example.com', password: 'differentPass456' },
        { login: 'user3', email: 'user3@example.com', password: 'anotherPassword789' },
      ];

      for (const dto of users) {
        await useCase.execute(new RegisterUserCommand(dto));
      }

      const createdUsers: User[] = await userRepo.find();
      expect(createdUsers).toHaveLength(3);

      const hashes: string[] = createdUsers.map((u) => u.passwordHash);
      expect(new Set(hashes).size).toBe(3);

      for (let i = 0; i < users.length; i++) {
        expect(createdUsers[i].passwordHash).not.toBe(users[i].password);
      }

      expect(eventBusSpy).toHaveBeenCalledTimes(3);
    });
  });

  describe('обработка ошибок валидации', () => {
    it('должен выбрасывать ValidationException при дублировании логина', async () => {
      const originalDto: UserInputDto = {
        login: 'duplicate',
        email: 'original@example.com',
        password: 'password123',
      };

      const duplicateDto: UserInputDto = {
        login: 'duplicate',
        email: 'different@example.com',
        password: 'password456',
      };

      await useCase.execute(new RegisterUserCommand(originalDto));

      try {
        await useCase.execute(new RegisterUserCommand(duplicateDto));

        fail('Ожидали ValidationException');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationException);
        expect(error.code).toBe('ValidationError');
        expect(error.extensions).toBeDefined();
        expect(error.extensions).toHaveLength(1);
        expect(error.extensions[0].field).toBe('login');
        expect(error.extensions[0].message).toBe('User with the same login already exists.');
      }

      expect(eventBusSpy).toHaveBeenCalledTimes(1);

      const usersCount: number = await userRepo.count();
      expect(usersCount).toBe(1);
    });

    it('должен выбрасывать ValidationException при дублировании email', async () => {
      const originalDto: UserInputDto = {
        login: 'original',
        email: 'duplicate@example.com',
        password: 'password123',
      };

      const duplicateDto: UserInputDto = {
        login: 'different',
        email: 'duplicate@example.com',
        password: 'password456',
      };

      await useCase.execute(new RegisterUserCommand(originalDto));

      try {
        await useCase.execute(new RegisterUserCommand(duplicateDto));

        fail('Ожидали ValidationException');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationException);
        expect(error.code).toBe('ValidationError');
        expect(error.extensions).toBeDefined();
        expect(error.extensions[0].field).toBe('email');
        expect(error.extensions[0].message).toBe('User with the same email already exists.');
      }

      expect(eventBusSpy).toHaveBeenCalledTimes(1);

      const usersCount: number = await userRepo.count();
      expect(usersCount).toBe(1);
    });

    it('должен выбрасывать ValidationException при одновременном дублировании логина и email', async () => {
      const originalDto: UserInputDto = {
        login: 'testuser',
        email: 'test@example.com',
        password: 'password123',
      };

      const fullDuplicateDto: UserInputDto = {
        login: 'testuser',
        email: 'test@example.com',
        password: 'password456',
      };

      await useCase.execute(new RegisterUserCommand(originalDto));

      try {
        await useCase.execute(new RegisterUserCommand(fullDuplicateDto));

        fail('Ожидали ValidationException');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationException);
        expect(error.code).toBe('ValidationError');
        expect(error.extensions).toBeDefined();
        expect(error.extensions).toHaveLength(1);
        expect(error.extensions[0].field).toBe('login');
        expect(error.extensions[0].message).toBe('User with the same login already exists.');
      }

      expect(eventBusSpy).toHaveBeenCalledTimes(1);

      const usersCount: number = await userRepo.count();
      expect(usersCount).toBe(1);
    });
  });

  describe('публикация событий', () => {
    it('должен публиковать событие UserRegisteredEvent с правильными данными', async () => {
      const dto: UserInputDto = {
        login: 'eventuser',
        email: 'eventuser@example.com',
        password: 'password123',
      };

      await useCase.execute(new RegisterUserCommand(dto));

      expect(eventBusSpy).toHaveBeenCalledTimes(1);

      const publishedEvent = eventBusSpy.mock.calls[0][0] as UserRegisteredEvent;
      expect(publishedEvent).toBeInstanceOf(UserRegisteredEvent);
      expect(publishedEvent.email).toBe(dto.email);
      expect(publishedEvent.confirmationCode).toBeDefined();
      expect(typeof publishedEvent.confirmationCode).toBe('string');
      expect(publishedEvent.confirmationCode.length).toBeGreaterThan(0);
    });

    it('не должен публиковать событие при ошибке валидации', async () => {
      const originalDto: UserInputDto = {
        login: 'existing',
        email: 'existing@example.com',
        password: 'password123',
      };
      await useCase.execute(new RegisterUserCommand(originalDto));

      eventBusSpy.mockClear();

      const duplicateDto: UserInputDto = {
        login: 'existing',
        email: 'different@example.com',
        password: 'password456',
      };

      await expect(useCase.execute(new RegisterUserCommand(duplicateDto))).rejects.toThrow(
        ValidationException,
      );

      expect(eventBusSpy).not.toHaveBeenCalled();
    });

    it('должен публиковать события для множественных регистраций', async () => {
      const dtos: UserInputDto[] = [
        { login: 'user1', email: 'user1@example.com', password: 'pass1' },
        { login: 'user2', email: 'user2@example.com', password: 'pass2' },
        { login: 'user3', email: 'user3@example.com', password: 'pass3' },
      ];

      for (const dto of dtos) {
        await useCase.execute(new RegisterUserCommand(dto));
      }

      expect(eventBusSpy).toHaveBeenCalledTimes(3);

      for (let i = 0; i < dtos.length; i++) {
        const event = eventBusSpy.mock.calls[i][0] as UserRegisteredEvent;
        expect(event.email).toBe(dtos[i].email);
        expect(event.confirmationCode).toBeDefined();
      }
    });
  });

  describe('граничные случаи валидации полей', () => {
    it('должен корректно обрабатывать минимальные значения полей', async () => {
      const dto: UserInputDto = {
        login: 'abc',
        email: 'a@b.co',
        password: '123456',
      };

      await useCase.execute(new RegisterUserCommand(dto));

      const user: User | null = await userRepo.findOne({
        relations: ['emailConfirmationCode'],
        where: { login: dto.login },
      });

      expect(user).toBeDefined();
      expect(user).not.toBeNull();
      expect(user!.emailConfirmationCode).toBeDefined();
      expect(user!.emailConfirmationCode).not.toBeNull();
      expect(user!.emailConfirmationCode.confirmationCode).toBeDefined();
      expect(user!.emailConfirmationCode.confirmationCode).not.toBeNull();
      expect(eventBusSpy).toHaveBeenCalledTimes(1);
    });

    it('должен корректно обрабатывать максимальные значения полей', async () => {
      const dto: UserInputDto = {
        login: '0123456789',
        email: 'verylongemail@domain.com',
        password: '01234567890123456789',
      };

      await useCase.execute(new RegisterUserCommand(dto));

      const user: User | null = await userRepo.findOne({
        relations: ['emailConfirmationCode'],
        where: { login: dto.login },
      });

      expect(user).toBeDefined();
      expect(user).not.toBeNull();
      expect(user!.emailConfirmationCode).toBeDefined();
      expect(user!.emailConfirmationCode).not.toBeNull();
      expect(user!.emailConfirmationCode.confirmationCode).toBeDefined();
      expect(user!.emailConfirmationCode.confirmationCode).not.toBeNull();
      expect(eventBusSpy).toHaveBeenCalledTimes(1);
    });

    it('должен корректно обрабатывать разрешенные символы в логине', async () => {
      const validLogins: string[] = ['user123', 'user_test', 'user-name', 'User_N-123'];

      for (let i = 0; i < validLogins.length; i++) {
        const dto: UserInputDto = {
          login: validLogins[i],
          email: `user${i}@example.com`,
          password: 'password123',
        };

        await useCase.execute(new RegisterUserCommand(dto));
      }

      const users: User[] = await userRepo.find();
      expect(users).toHaveLength(validLogins.length);
      expect(eventBusSpy).toHaveBeenCalledTimes(validLogins.length);
    });

    it('должен корректно обрабатывать различные форматы email', async () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co',
        'user_name@test-domain.org',
        'name123@sub.domain.info',
      ];

      for (let i = 0; i < validEmails.length; i++) {
        const dto: UserInputDto = {
          login: `user${i}`,
          email: validEmails[i],
          password: 'password123',
        };

        await useCase.execute(new RegisterUserCommand(dto));
      }

      const users: User[] = await userRepo.find();
      expect(users).toHaveLength(validEmails.length);

      const savedEmails: string[] = users.map((u) => u.email).sort();
      expect(savedEmails).toEqual(validEmails.sort());
    });
  });

  describe('последовательные регистрации', () => {
    it('должен корректно обрабатывать множественные регистрации подряд', async () => {
      const usersData: UserInputDto[] = [];
      for (let i = 1; i <= 10; i++) {
        usersData.push({
          login: `user${i}`,
          email: `user${i}@example.com`,
          password: `password${i}`,
        });
      }

      for (const dto of usersData) {
        await useCase.execute(new RegisterUserCommand(dto));
      }

      const createdUsers: User[] = await userRepo.find({
        relations: ['emailConfirmationCode'],
      });

      expect(createdUsers).toHaveLength(10);
      expect(eventBusSpy).toHaveBeenCalledTimes(10);

      const codes = createdUsers.map((u) => u.emailConfirmationCode.confirmationCode);
      expect(new Set(codes).size).toBe(10);

      const hashes: string[] = createdUsers.map((u) => u.passwordHash);
      expect(new Set(hashes).size).toBe(10);
    });

    it('должен корректно обрабатывать параллельную валидацию', async () => {
      const dto1: UserInputDto = {
        login: 'parallel1',
        email: 'parallel1@example.com',
        password: 'password123',
      };

      const dto2: UserInputDto = {
        login: 'parallel2',
        email: 'parallel2@example.com',
        password: 'password123',
      };

      const [result1, result2] = await Promise.allSettled([
        useCase.execute(new RegisterUserCommand(dto1)),
        useCase.execute(new RegisterUserCommand(dto2)),
      ]);

      expect(result1.status).toBe('fulfilled');
      expect(result2.status).toBe('fulfilled');

      const users: User[] = await userRepo.find();
      expect(users).toHaveLength(2);
      expect(eventBusSpy).toHaveBeenCalledTimes(2);
    });
  });
});
