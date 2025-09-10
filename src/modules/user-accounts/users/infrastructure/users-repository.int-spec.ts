import { Test, TestingModule } from '@nestjs/testing';
import { UsersRepository } from './users.repository';
import { User } from '../domain/entities/user.entity';
import { Repository } from 'typeorm';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseModule } from '../../../database/database.module';
import { EmailConfirmationCode } from '../../auth/domain/entities/email-confirmation-code.entity';
import { PasswordRecoveryCode } from '../../auth/domain/entities/password-recovery-code.entity';
import { Session } from '../../sessions/domain/entities/session.entity';

describe('UsersRepository', () => {
  let module: TestingModule;
  let repository: UsersRepository;
  let db: Repository<User>;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        DatabaseModule,
        TypeOrmModule.forFeature([User, EmailConfirmationCode, PasswordRecoveryCode, Session]),
      ],
      providers: [UsersRepository],
    }).compile();

    repository = module.get(UsersRepository);
    db = module.get(getRepositoryToken(User));
  });

  beforeEach(async () => {
    await db.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
  });

  describe('UsersRepository.save()', () => {
    it('should ', () => {
      const user = db.create({ login: 'user1', email: 'test@mail.com' });
      console.log(user);
    });
  });
});
