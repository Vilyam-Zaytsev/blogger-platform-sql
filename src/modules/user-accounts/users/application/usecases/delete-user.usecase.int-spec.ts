import { Test, TestingModule } from '@nestjs/testing';
import { DeleteUserCommand, DeleteUserUseCase } from './delete-user.usecase';
import { DataSource, Repository } from 'typeorm';
import { DatabaseModule } from '../../../../database/database.module';
import { CoreModule } from '../../../../../core/core.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailConfirmationCode } from '../../../auth/domain/entities/email-confirmation-code.entity';
import { PasswordRecoveryCode } from '../../../auth/domain/entities/password-recovery-code.entity';
import { Session } from '../../../sessions/domain/entities/session.entity';
import { UsersRepository } from '../../infrastructure/users.repository';
import { User } from '../../domain/entities/user.entity';
import { UsersFactory } from '../factories/users.factory';
import { CreateUserDto } from '../../dto/create-user.dto';
import { CryptoService } from '../services/crypto.service';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';

describe('DeleteUserUseCase (Integration)', () => {
  let module: TestingModule;
  let useCase: DeleteUserUseCase;
  let dataSource: DataSource;
  let usersFactory: UsersFactory;
  let repository: Repository<User>;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        DatabaseModule,
        CoreModule,
        TypeOrmModule.forFeature([User, EmailConfirmationCode, PasswordRecoveryCode, Session]),
      ],
      providers: [DeleteUserUseCase, UsersRepository, UsersFactory, CryptoService],
    }).compile();

    useCase = module.get<DeleteUserUseCase>(DeleteUserUseCase);
    dataSource = module.get<DataSource>(DataSource);
    usersFactory = module.get<UsersFactory>(UsersFactory);
    repository = dataSource.getRepository<User>(User);
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

  describe('успешное удалени пользователя', () => {
    it('должен выполнить soft delete существующего пользователя', async () => {
      const dto: CreateUserDto = {
        login: 'test_user',
        email: 'test.user@example.com',
        password: 'qwerty',
      };

      const user: User = await usersFactory.create(dto);
      const { id }: User = await repository.save(user);

      const userBeforeDelete: User | null = await repository.findOneBy({ id });
      expect(userBeforeDelete).toBeDefined();
      expect(userBeforeDelete).not.toBeNull();
      expect(userBeforeDelete!.deletedAt).toBeNull();

      await useCase.execute(new DeleteUserCommand(id));

      const userAfterDelete: User | null = await repository
        .createQueryBuilder('user')
        .withDeleted()
        .where('user.id = :id', { id })
        .getOne();

      expect(userAfterDelete).toBeDefined();
      expect(userAfterDelete).not.toBeNull();
      expect(userAfterDelete!.deletedAt).not.toBeNull();
      expect(userAfterDelete!.deletedAt).toBeInstanceOf(Date);

      const userNormalFind: User | null = await repository.findOneBy({ id });
      expect(userNormalFind).toBeNull();
    });

    it('должен корректно обрабатывать временные метки при soft delete', async () => {
      const dto: CreateUserDto = {
        login: 'test_user',
        email: 'test.user@example.com',
        password: 'qwerty',
      };

      const user: User = await usersFactory.create(dto);
      const { id }: User = await repository.save(user);

      const beforeDelete: number = Date.now();

      await useCase.execute(new DeleteUserCommand(id));

      const afterDelete: number = Date.now();

      const deletedUser: User | null = await repository
        .createQueryBuilder('user')
        .withDeleted()
        .where('user.id = :id', { id })
        .getOne();

      expect(deletedUser).not.toBeNull();
      expect(deletedUser).toBeDefined();
      expect(deletedUser!.deletedAt).not.toBeNull();
      expect(deletedUser!.deletedAt).toBeInstanceOf(Date);

      expect(deletedUser!.deletedAt!.getTime()).toBeGreaterThanOrEqual(beforeDelete);
      expect(deletedUser!.deletedAt!.getTime()).toBeLessThanOrEqual(afterDelete);
    });
  });

  describe('обработка ошибок', () => {
    it('должен выбрасывать DomainException при попытке удалить несуществующего пользователя', async () => {
      const nonExistentId: number = 99999;

      await expect(useCase.execute(new DeleteUserCommand(nonExistentId))).rejects.toThrow(
        DomainException,
      );
    });

    it('должен выбрасывать DomainException с правильным кодом NotFound', async () => {
      const nonExistentId = 88888;

      try {
        await useCase.execute(new DeleteUserCommand(nonExistentId));

        fail('Ожидали DomainException');
        fail('Ожидалось выбрасывание DomainException');
      } catch (error) {
        expect(error).toBeInstanceOf(DomainException);
        expect(error.code).toBe(DomainExceptionCode.NotFound);
        expect(error.message).toContain(`The user with ID (${nonExistentId}) does not exist`);
      }
    });

    it('должен выбрасывать ошибку при попытке удалить уже удаленного пользователя', async () => {
      const dto: CreateUserDto = {
        login: 'test_user',
        email: 'test.user@example.com',
        password: 'qwerty',
      };

      const user: User = await usersFactory.create(dto);
      const { id }: User = await repository.save(user);

      await useCase.execute(new DeleteUserCommand(id));

      await expect(useCase.execute(new DeleteUserCommand(id))).rejects.toThrow(DomainException);
    });
  });

  describe('граничные случаи', () => {
    it('должен корректно обрабатывать ID равный нулю', async () => {
      await expect(useCase.execute(new DeleteUserCommand(0))).rejects.toThrow(DomainException);
    });

    it('должен корректно обрабатывать отрицательные ID', async () => {
      await expect(useCase.execute(new DeleteUserCommand(-1))).rejects.toThrow(DomainException);
    });
  });
});
