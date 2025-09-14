import { Test, TestingModule } from '@nestjs/testing';
import { CreateSessionUseCase } from './create-session.usecase';
import { DataSource, Repository } from 'typeorm';
import { UsersFactory } from '../../../users/application/factories/users.factory';
import { User } from '../../../users/domain/entities/user.entity';
import { Session } from '../../domain/entities/session.entity';
import { DeleteSessionCommand, DeleteSessionUseCase } from './delete-session.usecase';
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
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';

describe('DeleteSessionUseCase (Integration)', () => {
  let module: TestingModule;
  let useCase: DeleteSessionUseCase;
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
        DeleteSessionUseCase,
        SessionsRepository,
        UsersRepository,
        UsersFactory,
        CryptoService,
      ],
    }).compile();

    useCase = module.get<DeleteSessionUseCase>(DeleteSessionUseCase);
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

  describe('успешное удаление сессии', () => {
    it('должен soft-delete сессию текущего пользователя', async () => {
      const { id: userId }: User = await createTestUser('test_user', 'test_user@example.com');
      const { id: sessionId, deviceId }: Session = await createTestSession(userId, 'device-1');

      const dto: SessionContextDto = { userId, deviceId };
      await useCase.execute(new DeleteSessionCommand(dto, deviceId));

      const deletedSession: Session | null = await sessionRepo
        .createQueryBuilder('s')
        .withDeleted()
        .where('s.id = :id', { id: sessionId })
        .getOne();

      expect(deletedSession).toBeDefined();
      expect(deletedSession).not.toBeNull();
      expect(deletedSession!.deletedAt).toBeInstanceOf(Date);

      const normal: Session | null = await sessionRepo.findOneBy({ id: sessionId });
      expect(normal).toBeNull();
    });
  });

  describe('обработка ошибок', () => {
    it('должен выбросить NotFound, если сессии не существует', async () => {
      const dto: SessionContextDto = { userId: 1, deviceId: 'nonexistent' };
      await expect(useCase.execute(new DeleteSessionCommand(dto, 'nonexistent'))).rejects.toThrow(
        DomainException,
      );
      await expect(
        useCase.execute(new DeleteSessionCommand(dto, 'nonexistent')),
      ).rejects.toMatchObject({ code: DomainExceptionCode.NotFound });
    });

    it('должен выбросить Forbidden, если сессия не принадлежит пользователю', async () => {
      const { id: userId_1 }: User = await createTestUser('test_user1', 'test_user1@example.com');
      const { id: userId_2 }: User = await createTestUser('test_user2', 'test_user2@example.com');
      const { deviceId }: Session = await createTestSession(userId_1, 'device-2');

      const dto: SessionContextDto = { userId: userId_2, deviceId };
      await expect(useCase.execute(new DeleteSessionCommand(dto, deviceId))).rejects.toThrow(
        DomainException,
      );
      await expect(useCase.execute(new DeleteSessionCommand(dto, deviceId))).rejects.toMatchObject({
        code: DomainExceptionCode.Forbidden,
      });
    });

    it('должен выбрасывать NotFound при повторном удалении той же сессии', async () => {
      const { id: userId }: User = await createTestUser('test_user', 'test_user@example.com');
      const { deviceId }: Session = await createTestSession(userId, 'device-1');

      const dto: SessionContextDto = { userId, deviceId };
      await useCase.execute(new DeleteSessionCommand(dto, deviceId));

      await expect(useCase.execute(new DeleteSessionCommand(dto, deviceId))).rejects.toMatchObject({
        code: DomainExceptionCode.NotFound,
      });
    });
  });
});
