// src/modules/user-accounts/sessions/application/services/sessions-cleanup.service.int-spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, IsNull, Repository } from 'typeorm';
import { DatabaseModule } from '../../../../database/database.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { SessionsRepository } from '../../infrastructure/sessions.repository';
import { SessionsCleanupService } from './sessions-cleanup.service';
import { UserAccountsConfig } from '../../../config/user-accounts.config';
import { Session } from '../../domain/entities/session.entity';
import { User } from '../../../users/domain/entities/user.entity';
import { UsersRepository } from '../../../users/infrastructure/users.repository';
import { UsersFactory } from '../../../users/application/factories/users.factory';
import { CryptoService } from '../../../users/application/services/crypto.service';
import { CreateUserDto } from '../../../users/dto/create-user.dto';
import { DateService } from '../../../users/application/services/date.service';
import { getRelatedEntities } from '../../../../../core/utils/get-related-entities.utility';
import { configModule } from '../../../../../dynamic-config.module';
import { UserInputDto } from '../../../users/api/input-dto/user.input-dto';

describe('SessionsCleanupService (Integration)', () => {
  let module: TestingModule;
  let cleanupService: SessionsCleanupService;
  let userAccountsConfig: UserAccountsConfig;
  let dataSource: DataSource;
  let sessionRepo: Repository<Session>;
  let userRepo: Repository<User>;
  let usersFactory: UsersFactory;
  let sessionsRepository: SessionsRepository;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        configModule,
        DatabaseModule,
        TypeOrmModule.forFeature(getRelatedEntities(User)),
        ScheduleModule.forRoot(),
      ],
      providers: [
        SessionsCleanupService,
        SessionsRepository,
        UsersRepository,
        UsersFactory,
        CryptoService,
        DateService,
        UserAccountsConfig,
      ],
    }).compile();

    cleanupService = module.get<SessionsCleanupService>(SessionsCleanupService);
    userAccountsConfig = module.get<UserAccountsConfig>(UserAccountsConfig);
    dataSource = module.get<DataSource>(DataSource);
    sessionRepo = dataSource.getRepository<Session>(Session);
    userRepo = dataSource.getRepository<User>(User);
    usersFactory = module.get<UsersFactory>(UsersFactory);
    sessionsRepository = module.get<SessionsRepository>(SessionsRepository);
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

  const createTestUser = async (userData?: Partial<UserInputDto>): Promise<User> => {
    const dto: CreateUserDto = {
      login: 'test_user',
      email: 'test_user@example.com',
      password: 'qwerty',
      ...userData,
    };

    const user: User = await usersFactory.create(dto);
    return await userRepo.save(user);
  };

  async function createTestSession(
    userId: number,
    deviceId: string,
    deletedAt?: Date,
  ): Promise<Session> {
    const session: Session = Session.create({
      userId,
      deviceId,
      deviceName: 'Test Device',
      ip: '127.0.0.1',
      iat: new Date(),
      exp: new Date(Date.now() + 3600 * 1000),
    });

    const saved = await sessionRepo.save(session);

    if (deletedAt) {
      await sessionRepo.update({ id: saved.id }, { deletedAt });
    }

    return saved;
  }

  describe('hardDeleteOldSessions() с использованием конфига', () => {
    describe('успешное удаление старых сессий', () => {
      it('должен использовать значение из конфига для удаления старых сессий', async () => {
        const retentionDays: number = userAccountsConfig.sessionCleanupRetentionDays;
        expect(retentionDays).toBe(90);

        const user: User = await createTestUser();

        // Сессия, удаленная более N дней назад (СТАРАЯ — должна быть удалена)
        const oldDeletedDate = new Date();
        oldDeletedDate.setDate(oldDeletedDate.getDate() - (retentionDays + 1));
        const oldSession: Session = await createTestSession(user.id, 'device-old', oldDeletedDate);

        // Сессия, удаленная менее N дней назад (СВЕЖАЯ — должна остаться)
        const recentDeletedDate = new Date();
        recentDeletedDate.setDate(recentDeletedDate.getDate() - (retentionDays - 1));
        const recentSession: Session = await createTestSession(
          user.id,
          'device-recent',
          recentDeletedDate,
        );

        const deletedCount: number =
          await sessionsRepository.hardDeleteOldSoftDeletedSessions(retentionDays);

        expect(deletedCount).toBe(1);

        const oldSessionExists: Session | null = await sessionRepo.findOne({
          where: { id: oldSession.id },
          withDeleted: true,
        });
        expect(oldSessionExists).toBeNull();

        // Проверяем, что свежая сессия остается
        const recentSessionExists: Session | null = await sessionRepo.findOne({
          where: { id: recentSession.id },
          withDeleted: true,
        });
        expect(recentSessionExists).toBeDefined();
        expect(recentSessionExists!.deletedAt).toEqual(recentDeletedDate);
      });

      it('должен удалить несколько старых сессий с использованием конфига', async () => {
        const retentionDays: number = userAccountsConfig.sessionCleanupRetentionDays;

        const user: User = await createTestUser();

        const oldDeletedDate = new Date();
        oldDeletedDate.setDate(oldDeletedDate.getDate() - (retentionDays + 10));

        await createTestSession(user.id, 'device-1', oldDeletedDate);
        await createTestSession(user.id, 'device-2', oldDeletedDate);
        await createTestSession(user.id, 'device-3', oldDeletedDate);

        const deletedCount: number =
          await sessionsRepository.hardDeleteOldSoftDeletedSessions(retentionDays);

        expect(deletedCount).toBe(3);

        const remainingSessions: Session[] = await sessionRepo.find({
          where: { userId: user.id },
          withDeleted: true,
        });
        expect(remainingSessions.length).toBe(0);
      });

      it('должен не удалять активные (не soft-deleted) сессии', async () => {
        const retentionDays: number = userAccountsConfig.sessionCleanupRetentionDays;

        const user: User = await createTestUser();
        const activeSession: Session = await createTestSession(user.id, 'active-device');

        expect(activeSession.deletedAt).toBeNull();

        const deletedCount: number =
          await sessionsRepository.hardDeleteOldSoftDeletedSessions(retentionDays);

        expect(deletedCount).toBe(0);

        const sessionInDb: Session | null = await sessionRepo.findOne({
          where: { id: activeSession.id },
        });
        expect(sessionInDb).toBeDefined();
        expect(sessionInDb!.deletedAt).toBeNull();
      });

      it('должен вернуть 0, если нет старых soft-deleted сессий', async () => {
        const retentionDays: number = userAccountsConfig.sessionCleanupRetentionDays;

        const user: User = await createTestUser();

        const recentDeletedDate = new Date();
        recentDeletedDate.setDate(recentDeletedDate.getDate() - (retentionDays - 30));
        await createTestSession(user.id, 'fresh-device', recentDeletedDate);

        const deletedCount: number =
          await sessionsRepository.hardDeleteOldSoftDeletedSessions(retentionDays);

        expect(deletedCount).toBe(0);

        const sessionInDb: Session | null = await sessionRepo.findOne({
          where: { deletedAt: recentDeletedDate },
          withDeleted: true,
        });
        expect(sessionInDb).toBeDefined();
      });

      it('должен удалить старые сессии нескольких пользователей', async () => {
        const retentionDays: number = userAccountsConfig.sessionCleanupRetentionDays;
        const user1: User = await createTestUser({ login: 'user1', email: 'user1@example.com' });
        const user2: User = await createTestUser({ login: 'user2', email: 'user2@example.com' });

        const oldDeletedDate = new Date();
        oldDeletedDate.setDate(oldDeletedDate.getDate() - (retentionDays + 1));

        await createTestSession(user1.id, 'user1-device', oldDeletedDate);
        await createTestSession(user2.id, 'user2-device', oldDeletedDate);

        const deletedCount: number =
          await sessionsRepository.hardDeleteOldSoftDeletedSessions(retentionDays);

        expect(deletedCount).toBe(2);

        const allSessions: Session[] = await sessionRepo.find({
          withDeleted: true,
        });
        expect(allSessions.length).toBe(0);
      });
    });
  });

  describe('handleHardDeleteOldSessions() (Cron метод с конфигом)', () => {
    it('должен успешно выполнить Cron задачу с периодом из конфига', async () => {
      const retentionDays: number = userAccountsConfig.sessionCleanupRetentionDays;

      const user: User = await createTestUser();

      const oldDeletedDate = new Date();
      oldDeletedDate.setDate(oldDeletedDate.getDate() - (retentionDays + 1));
      await createTestSession(user.id, 'cron-device', oldDeletedDate);

      // Мокируем logger для проверки логирования
      const logSpy = jest.spyOn(cleanupService['logger'], 'log');
      const debugSpy = jest.spyOn(cleanupService['logger'], 'debug');

      // вызываем Cron метод напрямую
      await cleanupService.handHardDeleteOldSessions();

      // проверяем логирование
      expect(debugSpy).toHaveBeenCalledWith(
        'Starting hard delete job for old soft-deleted sessions...',
      );
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Hard delete job completed: 1 old sessions permanently deleted'),
      );

      logSpy.mockRestore();
      debugSpy.mockRestore();
    });

    it('должен залогировать информацию об использованном периоде из конфига', async () => {
      const retentionDays: number = userAccountsConfig.sessionCleanupRetentionDays;

      const user: User = await createTestUser();

      const oldDeletedDate = new Date();
      oldDeletedDate.setDate(oldDeletedDate.getDate() - (retentionDays + 5));
      await createTestSession(user.id, 'config-log-device', oldDeletedDate);

      // Мокируем logger
      const logSpy = jest.spyOn(cleanupService['logger'], 'log');

      // вызываем Cron метод
      await cleanupService.handHardDeleteOldSessions();

      // проверяем логирование (видим результат)
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Hard delete job completed:'));

      logSpy.mockRestore();
    });

    it('должен обработать ошибку БД и залогировать её', async () => {
      // мокируем репозиторий для выброса ошибки
      const spy = jest
        .spyOn(sessionsRepository, 'hardDeleteOldSoftDeletedSessions')
        .mockRejectedValue(new Error('DB Error'));

      // Мокируем logger для проверки логирования ошибки
      const errorSpy = jest.spyOn(cleanupService['logger'], 'error');

      // вызываем Cron метод
      await cleanupService.handHardDeleteOldSessions();

      //  проверяем, что ошибка залогирована
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Hard delete job failed'),
        expect.any(String),
      );

      spy.mockRestore();
      errorSpy.mockRestore();
    });

    it('не должен выбросить ошибку при ошибке БД (идемпотентность)', async () => {
      // мокируем репозиторий для выброса ошибки
      const spy = jest
        .spyOn(sessionsRepository, 'hardDeleteOldSoftDeletedSessions')
        .mockRejectedValue(new Error('Connection lost'));

      // метод не должен выбросить ошибку
      await expect(cleanupService.handHardDeleteOldSessions()).resolves.not.toThrow();

      spy.mockRestore();
    });
  });

  describe('интеграционные сценарии с конфигом', () => {
    it('должен обработать реалистичный сценарий: смесь активных и удаленных сессий', async () => {
      const retentionDays = userAccountsConfig.sessionCleanupRetentionDays;

      const user1: User = await createTestUser({ login: 'user1', email: 'user1@example.com' });
      const user2: User = await createTestUser({ login: 'user2', email: 'user2@example.com' });

      const now = new Date();

      // User 1: активная сессия (не удалена)
      await createTestSession(user1.id, 'user1-active');

      // User 1: старая soft-deleted сессия (должна быть удалена)
      const oldDate = new Date(now);
      oldDate.setDate(oldDate.getDate() - (retentionDays + 5));
      await createTestSession(user1.id, 'user1-old-deleted', oldDate);

      // User 1: свежая soft-deleted сессия (не должна быть удалена)
      const freshDate = new Date(now);
      freshDate.setDate(freshDate.getDate() - (retentionDays - 10));
      await createTestSession(user1.id, 'user1-fresh-deleted', freshDate);

      // User 2: активные сессии (не удалены)
      await createTestSession(user2.id, 'user2-active-1');
      await createTestSession(user2.id, 'user2-active-2');

      // User 2: старая soft-deleted сессия (должна быть удалена)
      const oldDate2 = new Date(now);
      oldDate2.setDate(oldDate2.getDate() - (retentionDays + 10));
      await createTestSession(user2.id, 'user2-old-deleted', oldDate2);

      // запускаем hard delete с периодом из конфига
      const deletedCount: number =
        await sessionsRepository.hardDeleteOldSoftDeletedSessions(retentionDays);

      // проверяем результаты
      expect(deletedCount).toBe(2); // Две старые сессии удалены

      // Проверяем, что активные сессии остались
      const activeSessions: Session[] = await sessionRepo.find({
        where: { deletedAt: IsNull() },
      });
      expect(activeSessions.length).toBe(3); // 1 у user1 + 2 у user2

      // Проверяем, что свежие soft-deleted остались
      const softDeletedSessions: Session[] = await sessionRepo.find({
        where: { deletedAt: freshDate },
        withDeleted: true,
      });
      expect(softDeletedSessions.length).toBe(1);
    });

    it('должен корректно работать при повторном запуске (идемпотентность)', async () => {
      const retentionDays: number = userAccountsConfig.sessionCleanupRetentionDays;

      const user: User = await createTestUser();

      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - (retentionDays + 1));
      await createTestSession(user.id, 'device-1', oldDate);
      await createTestSession(user.id, 'device-2', oldDate);

      // запускаем hard delete в первый раз
      const deletedCount1: number =
        await sessionsRepository.hardDeleteOldSoftDeletedSessions(retentionDays);

      // запускаем hard delete во второй раз
      const deletedCount2: number =
        await sessionsRepository.hardDeleteOldSoftDeletedSessions(retentionDays);

      expect(deletedCount1).toBe(2);
      expect(deletedCount2).toBe(0);
    });

    it('должен использовать конфиг в методе handHardDeleteOldSessions', async () => {
      const retentionDays: number = userAccountsConfig.sessionCleanupRetentionDays;

      const user: User = await createTestUser();

      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - (retentionDays + 1));
      await createTestSession(user.id, 'cron-config-device', oldDate);

      // Мокируем logger
      const logSpy = jest.spyOn(cleanupService['logger'], 'log');

      // вызываем Cron метод, который использует конфиг внутри
      await cleanupService.handHardDeleteOldSessions();

      // проверяем, что произошло удаление (результат логируется)
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Hard delete job completed: 1 old sessions permanently deleted'),
      );

      // Проверяем, что сессия действительно удалена
      const sessionInDb: Session | null = await sessionRepo.findOne({
        where: { userId: user.id },
        withDeleted: true,
      });
      expect(sessionInDb).toBeNull();

      logSpy.mockRestore();
    });
  });
});
