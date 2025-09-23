import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, Repository } from 'typeorm';
import { UsersFactory } from '../../../users/application/factories/users.factory';
import { User } from '../../../users/domain/entities/user.entity';
import { Session } from '../../domain/entities/session.entity';
import { GetSessionsQuery, GetSessionsQueryHandler } from './get-sessions.query-handler';
import { DatabaseModule } from '../../../../database/database.module';
import { CoreModule } from '../../../../../core/core.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailConfirmationCode } from '../../../auth/domain/entities/email-confirmation-code.entity';
import { PasswordRecoveryCode } from '../../../auth/domain/entities/password-recovery-code.entity';
import { SessionsRepository } from '../../infrastructure/sessions.repository';
import { UsersRepository } from '../../../users/infrastructure/users.repository';
import { CryptoService } from '../../../users/application/services/crypto.service';
import { CreateUserDto } from '../../../users/dto/create-user.dto';
import { SessionContextDto } from '../../../auth/domain/guards/dto/session-context.dto';
import { SessionViewDto } from '../../api/view-dto/session.view-dto';
import { SessionsQueryRepository } from '../../infrastructure/query/sessions.query-repository';
import { DateService } from '../../../users/application/services/date.service';

describe('GetSessionsQueryHandler (Integration)', () => {
  let module: TestingModule;
  let queryHandler: GetSessionsQueryHandler;
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
        GetSessionsQueryHandler,
        SessionsQueryRepository,
        SessionsRepository,
        UsersRepository,
        UsersFactory,
        CryptoService,
        DateService,
      ],
    }).compile();

    queryHandler = module.get<GetSessionsQueryHandler>(GetSessionsQueryHandler);
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

  async function createTestSession(
    userId: number,
    deviceId: string,
    deviceName: string = `Device-${deviceId}`,
    ip: string = '127.0.0.1',
    iat: Date = new Date(),
  ): Promise<Session> {
    const session: Session = Session.create({
      userId,
      deviceId,
      deviceName,
      ip,
      iat,
      exp: new Date(iat.getTime() + 3600 * 1000),
    });

    return await sessionRepo.save(session);
  }

  describe('базовые сценарии получения сессий', () => {
    it('должен возвращать пустой массив, если у пользователя нет сессий', async () => {
      const { id: userId }: User = await createTestUser('test_user', 'test_user@example.com');
      const dto: SessionContextDto = { userId, deviceId: 'any-device' };

      const result: SessionViewDto[] = await queryHandler.execute(new GetSessionsQuery(dto));

      expect(result).toEqual([]);
      expect(Array.isArray(result)).toBe(true);
    });

    it('должен возвращать одну сессию пользователя в правильном формате', async () => {
      const { id: userId }: User = await createTestUser('test_user', 'test_user@example.com');
      const iatDate = new Date('2025-01-15T10:00:00.000Z');
      await createTestSession(userId, 'device-001', 'iPhone 15', '192.168.1.100', iatDate);

      const dto: SessionContextDto = { userId, deviceId: 'device-001' };
      const result: SessionViewDto[] = await queryHandler.execute(new GetSessionsQuery(dto));

      expect(result).toHaveLength(1);
      const session: SessionViewDto = result[0];

      expect(session).toHaveProperty('ip');
      expect(session).toHaveProperty('title');
      expect(session).toHaveProperty('lastActiveDate');
      expect(session).toHaveProperty('deviceId');

      expect(session.ip).toBe('192.168.1.100');
      expect(session.title).toBe('iPhone 15');
      expect(session.lastActiveDate).toBe(iatDate.toISOString());
      expect(session.deviceId).toBe('device-001');
    });

    it('должен возвращать несколько сессий пользователя', async () => {
      const { id: userId }: User = await createTestUser('test_user', 'test_user@example.com');
      const baseDate = new Date('2025-01-15T10:00:00.000Z');

      await createTestSession(
        userId,
        'desktop-001',
        'Windows PC',
        '192.168.1.10',
        new Date(baseDate.getTime()),
      );
      await createTestSession(
        userId,
        'mobile-001',
        'Android Phone',
        '192.168.1.20',
        new Date(baseDate.getTime() + 1000),
      );
      await createTestSession(
        userId,
        'tablet-001',
        'iPad Pro',
        '192.168.1.30',
        new Date(baseDate.getTime() + 2000),
      );

      const dto: SessionContextDto = { userId: userId, deviceId: 'any-device' };
      const result: SessionViewDto[] = await queryHandler.execute(new GetSessionsQuery(dto));

      expect(result).toHaveLength(3);

      const deviceIds: string[] = result.map((s) => s.deviceId).sort();
      expect(deviceIds).toEqual(['desktop-001', 'mobile-001', 'tablet-001']);

      const ips: string[] = result.map((s) => s.ip).sort();
      expect(ips).toEqual(['192.168.1.10', '192.168.1.20', '192.168.1.30']);

      const titles: string[] = result.map((s) => s.title).sort();
      expect(titles).toEqual(['Android Phone', 'Windows PC', 'iPad Pro']);
    });
  });

  describe('изоляция пользователей', () => {
    it('не должен возвращать сессии другого пользователя', async () => {
      const { id: userId_1 }: User = await createTestUser('user_one', 'user_one@example.com');
      const { id: userId_2 }: User = await createTestUser('user_two', 'user_two@example.com');

      await createTestSession(userId_1, 'user1-device', 'User1 Device', '10.0.0.1');
      await createTestSession(userId_2, 'user2-device', 'User2 Device', '10.0.0.2');

      const dto1: SessionContextDto = { userId: userId_1, deviceId: 'user1-device' };
      const result1: SessionViewDto[] = await queryHandler.execute(new GetSessionsQuery(dto1));

      expect(result1).toHaveLength(1);
      expect(result1[0].deviceId).toBe('user1-device');
      expect(result1[0].title).toBe('User1 Device');
      expect(result1[0].ip).toBe('10.0.0.1');

      const dto2: SessionContextDto = { userId: userId_2, deviceId: 'user2-device' };
      const result2: SessionViewDto[] = await queryHandler.execute(new GetSessionsQuery(dto2));

      expect(result2).toHaveLength(1);
      expect(result2[0].deviceId).toBe('user2-device');
      expect(result2[0].title).toBe('User2 Device');
      expect(result2[0].ip).toBe('10.0.0.2');
    });
  });

  describe('обработка soft-deleted сессий', () => {
    it('не должен возвращать soft-deleted сессии', async () => {
      const { id: userId }: User = await createTestUser('test_user', 'test_user@example.com');

      const activeSession: Session = await createTestSession(
        userId,
        'active-device',
        'Active Device',
      );
      const deletedSession: Session = await createTestSession(
        userId,
        'deleted-device',
        'Deleted Device',
      );

      const dto: SessionContextDto = { userId, deviceId: 'any-device' };
      let result: SessionViewDto[] = await queryHandler.execute(new GetSessionsQuery(dto));
      expect(result).toHaveLength(2);

      await sessionRepo.softDelete(deletedSession.id);

      result = await queryHandler.execute(new GetSessionsQuery(dto));
      expect(result).toHaveLength(1);
      expect(result[0].deviceId).toBe('active-device');
      expect(result[0].title).toBe('Active Device');
    });

    it('должен возвращать пустой массив если все сессии soft-deleted', async () => {
      const { id: userId }: User = await createTestUser('test_user', 'test_user@example.com');

      const { id: sessionId_1 }: Session = await createTestSession(userId, 'device-1', 'Device 1');
      const { id: sessionId_2 }: Session = await createTestSession(userId, 'device-2', 'Device 2');

      await sessionRepo.softDelete(sessionId_1);
      await sessionRepo.softDelete(sessionId_2);

      const dto: SessionContextDto = { userId, deviceId: 'any-device' };
      const result: SessionViewDto[] = await queryHandler.execute(new GetSessionsQuery(dto));

      expect(result).toEqual([]);
    });
  });

  describe('граничные случаи', () => {
    it('должен обрабатывать несуществующего пользователя', async () => {
      const dto: SessionContextDto = { userId: 999999, deviceId: 'any-device' };
      const result: SessionViewDto[] = await queryHandler.execute(new GetSessionsQuery(dto));

      expect(result).toEqual([]);
    });
  });
});
