import { parseUserAgent } from '../../../../../core/utils/user-agent.parser';
import { Test, TestingModule } from '@nestjs/testing';
import { CreateSessionCommand, CreateSessionUseCase } from './create-session.usecase';
import { DataSource, Repository } from 'typeorm';
import { UsersFactory } from '../../../users/application/factories/users.factory';
import { User } from '../../../users/domain/entities/user.entity';
import { Session } from '../../domain/entities/session.entity';
import { DatabaseModule } from '../../../../database/database.module';
import { CoreModule } from '../../../../../core/core.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailConfirmationCode } from '../../../auth/domain/entities/email-confirmation-code.entity';
import { PasswordRecoveryCode } from '../../../auth/domain/entities/password-recovery-code.entity';
import { SessionsRepository } from '../../infrastructure/sessions.repository';
import { UsersRepository } from '../../../users/infrastructure/users.repository';
import { CryptoService } from '../../../users/application/services/crypto.service';
import { CreateUserDto } from '../../../users/dto/create-user.dto';
import { CreateSessionDto } from '../../dto/create-session.dto';
import { DateService } from '../../../users/application/services/date.service';

jest.mock('../../../../../core/utils/user-agent.parser');
const mockParseUserAgent = parseUserAgent as jest.MockedFunction<typeof parseUserAgent>;

describe('CreateSessionUseCase (Integration)', () => {
  let module: TestingModule;
  let useCase: CreateSessionUseCase;
  let dataSource: DataSource;
  let usersFactory: UsersFactory;
  let userRepo: Repository<User>;
  let sessionRepo: Repository<Session>;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        DatabaseModule,
        CoreModule,
        TypeOrmModule.forFeature([User, EmailConfirmationCode, PasswordRecoveryCode, Session]),
      ],
      providers: [
        CreateSessionUseCase,
        SessionsRepository,
        UsersRepository,
        UsersFactory,
        CryptoService,
        DateService,
      ],
    }).compile();

    useCase = module.get<CreateSessionUseCase>(CreateSessionUseCase);
    dataSource = module.get<DataSource>(DataSource);
    usersFactory = module.get<UsersFactory>(UsersFactory);
    userRepo = dataSource.getRepository<User>(User);
    sessionRepo = dataSource.getRepository<Session>(Session);
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE TABLE sessions RESTART IDENTITY CASCADE');
    await dataSource.query('TRUNCATE TABLE password_recovery_codes RESTART IDENTITY CASCADE');
    await dataSource.query('TRUNCATE TABLE email_confirmation_codes RESTART IDENTITY CASCADE');
    await dataSource.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');

    jest.clearAllMocks();
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

  describe('успешное создание сессии', () => {
    it('должен создать сессию с валидными данными', async () => {
      mockParseUserAgent.mockReturnValue('Windows');

      const { id: userId }: User = await createTestUser('test_user', 'test_user@example.com');
      const currentTime: number = Math.floor(Date.now() / 1000);

      const dto: CreateSessionDto = {
        userId,
        deviceId: 'device-123-unique',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        ip: '192.168.1.100',
        iat: currentTime,
        exp: currentTime + 3600,
      };

      await useCase.execute(new CreateSessionCommand(dto));

      expect(mockParseUserAgent).toHaveBeenCalledWith(dto.userAgent);
      expect(mockParseUserAgent).toHaveBeenCalledTimes(1);

      const sessions: Session[] = await sessionRepo.find({ where: { userId } });
      expect(sessions).toHaveLength(1);

      const session: Session = sessions[0];
      expect(session.deviceId).toBe(dto.deviceId);
      expect(session.deviceName).toBe('Windows');
      expect(session.ip).toBe(dto.ip);
      expect(session.userId).toBe(userId);
      expect(session.iat.getTime()).toBe(dto.iat * 1000);
      expect(session.exp.getTime()).toBe(dto.exp * 1000);

      expect(session.userId).toBeDefined();
      expect(session.createdAt).toBeInstanceOf(Date);
      expect(session.updatedAt).toBeInstanceOf(Date);
    });

    it('должен корректно парсить различные userAgent строки', async () => {
      const { parseUserAgent: realParse } = jest.requireActual(
        '../../../../../core/utils/user-agent.parser',
      );
      mockParseUserAgent.mockImplementation(realParse);

      const { id: userId }: User = await createTestUser('test_user', 'test_user@example.com');
      const currentTime: number = Math.floor(Date.now() / 1000);

      const testCases = [
        {
          userAgent:
            'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) ' +
            'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
          expectedDevice: 'iOS',
          expectedBrowser: 'Mobile Safari 15.0',
          deviceId: 'iphone-device-001',
        },
        {
          userAgent:
            'Mozilla/5.0 (Linux; Android 11; SM-G991B) ' +
            'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/93.0.4577.82 Mobile Safari/537.36',
          expectedDevice: 'Android',
          expectedBrowser: 'Mobile Chrome 93.0.4577.82',
          deviceId: 'android-device-002',
        },
        {
          userAgent:
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7; rv:92.0) ' +
            'Gecko/20100101 Firefox/92.0',
          expectedDevice: 'macOS',
          expectedBrowser: 'Firefox 92.0',
          deviceId: 'macos-device-003',
        },
      ];

      for (const testCase of testCases) {
        const dto: CreateSessionDto = {
          userId,
          deviceId: testCase.deviceId,
          userAgent: testCase.userAgent,
          ip: '10.0.0.1',
          iat: currentTime,
          exp: currentTime + 7200,
        };

        await useCase.execute(new CreateSessionCommand(dto));

        const session: Session | null = await sessionRepo.findOne({
          where: { deviceId: testCase.deviceId },
        });

        expect(session).toBeDefined();
        expect(session).not.toBeNull();
        expect(session!.deviceName).toBe(
          `${testCase.expectedBrowser} on ${testCase.expectedDevice}`,
        );
      }
    });

    it('должен создавать несколько сессий для одного пользователя', async () => {
      mockParseUserAgent.mockReturnValue('Multi Device');

      const { id: userId }: User = await createTestUser('test_user', 'test_user@example.com');
      const currentTime: number = Math.floor(Date.now() / 1000);

      for (let i = 1; i <= 3; i++) {
        const dto: CreateSessionDto = {
          userId,
          deviceId: `device-${i}-${Date.now()}`,
          userAgent: `Test Agent ${i}`,
          ip: `192.168.1.${i}`,
          iat: currentTime + i,
          exp: currentTime + i + 3600,
        };

        await useCase.execute(new CreateSessionCommand(dto));
      }

      const sessions: Session[] = await sessionRepo.find({ where: { userId } });
      expect(sessions).toHaveLength(3);

      const deviceIds: string[] = sessions.map((s) => s.deviceId);
      expect(new Set(deviceIds).size).toBe(3);
    });
  });
  describe('обработка ошибок валидации', () => {
    it('должен выбрасывать ошибку при создании сессии с несуществующим userId', async () => {
      mockParseUserAgent.mockReturnValue('Invalid User Device');

      const dto: CreateSessionDto = {
        userId: 999999,
        deviceId: 'invalid-user-device',
        userAgent: 'Test Agent',
        ip: '127.0.0.1',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      await expect(useCase.execute(new CreateSessionCommand(dto))).rejects.toThrowError();

      const session: Session | null = await sessionRepo.findOne({
        where: { deviceId: dto.deviceId },
      });
      expect(session).toBeNull();
    });

    it('должен выбрасывать ошибку при дублировании deviceId', async () => {
      mockParseUserAgent.mockReturnValue('Duplicate Device');

      const { id: userId }: User = await createTestUser('test_user', 'test_user@example.com');
      const currentTime = Math.floor(Date.now() / 1000);

      const dto1: CreateSessionDto = {
        userId,
        deviceId: 'duplicate-device-id',
        userAgent: 'First Agent',
        ip: '192.168.1.1',
        iat: currentTime,
        exp: currentTime + 3600,
      };

      await useCase.execute(new CreateSessionCommand(dto1));

      const dto2: CreateSessionDto = {
        userId,
        deviceId: 'duplicate-device-id',
        userAgent: 'Second Agent',
        ip: '192.168.1.2',
        iat: currentTime + 1000,
        exp: currentTime + 3700,
      };

      await expect(useCase.execute(new CreateSessionCommand(dto2))).rejects.toThrowError();

      const sessions: Session[] = await sessionRepo.find({
        where: { deviceId: 'duplicate-device-id' },
      });
      expect(sessions).toHaveLength(1);
      expect(sessions[0].ip).toBe('192.168.1.1');
    });
  });
});
