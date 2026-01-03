import { Test, TestingModule } from '@nestjs/testing';
import { DeleteSessionsCommand, DeleteSessionsUseCase } from './delete-sessions.usecase';
import { DataSource, Repository } from 'typeorm';
import { UsersFactory } from '../../../users/application/factories/users.factory';
import { User } from '../../../users/domain/entities/user.entity';
import { Session } from '../../domain/entities/session.entity';
import { DatabaseModule } from '../../../../database/database.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SessionsRepository } from '../../infrastructure/sessions.repository';
import { UsersRepository } from '../../../users/infrastructure/users.repository';
import { CryptoService } from '../../../users/application/services/crypto.service';
import { CreateUserDto } from '../../../users/dto/create-user.dto';
import { SessionContextDto } from '../../../auth/domain/guards/dto/session-context.dto';
import { DateService } from '../../../users/application/services/date.service';
import { getRelatedEntities } from '../../../../../core/utils/get-related-entities.utility';
import { configModule } from '../../../../../dynamic-config.module';
import { TransactionHelper } from '../../../../../trasaction.helper';

describe('DeleteSessionsUseCase (Integration)', () => {
  let module: TestingModule;
  let useCase: DeleteSessionsUseCase;
  let dataSource: DataSource;
  let usersFactory: UsersFactory;
  let userRepo: Repository<User>;
  let sessionRepo: Repository<Session>;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        configModule,
        DatabaseModule,
        TypeOrmModule.forFeature(getRelatedEntities(Session)),
      ],
      providers: [
        DeleteSessionsUseCase,
        SessionsRepository,
        UsersRepository,
        UsersFactory,
        CryptoService,
        DateService,
        TransactionHelper,
      ],
    }).compile();

    useCase = module.get<DeleteSessionsUseCase>(DeleteSessionsUseCase);
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

  async function createTestSession(userId: number, deviceId: string): Promise<Session> {
    const session: Session = Session.create({
      userId,
      deviceId,
      deviceName: 'TestDevice',
      ip: '127.0.0.1',
      iat: new Date(),
      exp: new Date(Date.now() + 3600 * 1000),
    });

    return await sessionRepo.save(session);
  }

  describe('корректная работа удаления', () => {
    it('должен soft-delete все сессии пользователя кроме текущей', async () => {
      const { id: userId }: User = await createTestUser('test_user', 'test_user@example.com');

      const currentDeviceId = 'device-current';

      for (const id of ['device-1', currentDeviceId, 'device-2']) {
        await createTestSession(userId, id);
      }

      const activeSessions: Session[] = await sessionRepo.find({ where: { userId } });
      expect(activeSessions).toHaveLength(3);

      const dto: SessionContextDto = {
        userId,
        deviceId: currentDeviceId,
      };
      await useCase.execute(new DeleteSessionsCommand(dto));

      const currentSession: Session | null = await sessionRepo.findOne({
        where: { userId, deviceId: currentDeviceId },
      });
      expect(currentSession).toBeDefined();
      expect(currentSession).not.toBeNull();
      expect(currentSession!.deletedAt).toBeNull();

      const allSessions: Session[] = await sessionRepo
        .createQueryBuilder('s')
        .withDeleted()
        .where('s.userId = :userId', { userId })
        .getMany();

      const deleted: Session[] = allSessions.filter((s) => s.deviceId !== currentDeviceId);
      for (const s of deleted) {
        expect(s.deletedAt).toBeInstanceOf(Date);
      }

      const activeAfter: Session[] = await sessionRepo.find({ where: { userId } });
      expect(activeAfter).toHaveLength(1);
      expect(activeAfter[0].deviceId).toBe(currentDeviceId);
    });

    it('не должен удалять сессии других пользователей', async () => {
      const { id: userId_1 }: User = await createTestUser('user_one', 'user_one@example.com');
      const { id: userId_2 }: User = await createTestUser('user_two', 'user_two@example.com');

      await createTestSession(userId_1, 'device-a');
      await createTestSession(userId_1, 'device-b');
      const sessionCurrent: Session = await createTestSession(userId_1, 'device-c');
      await createTestSession(userId_2, 'device-z');

      const dto: SessionContextDto = {
        userId: userId_1,
        deviceId: sessionCurrent.deviceId,
      };
      await useCase.execute(new DeleteSessionsCommand(dto));

      const foreignSession: Session | null = await sessionRepo.findOne({
        where: { userId: userId_2, deviceId: 'device-z' },
      });
      expect(foreignSession).toBeDefined();
      expect(foreignSession).not.toBeNull();
      expect(foreignSession!.deletedAt).toBeNull();
    });

    it('не должен удалять текущую сессию, если кроме текущей сессии других нет', async () => {
      const { id: userId }: User = await createTestUser('test_user', 'test_user@example.com');
      const { deviceId }: Session = await createTestSession(userId, 'only-device');
      const dto: SessionContextDto = {
        userId,
        deviceId,
      };
      await useCase.execute(new DeleteSessionsCommand(dto));

      const active: Session[] = await sessionRepo.find({ where: { userId } });
      expect(active).toHaveLength(1);
      expect(active[0].deletedAt).toBeNull();
    });
  });
});
