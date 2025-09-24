import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, Repository } from 'typeorm';
import { UsersFactory } from '../../../users/application/factories/users.factory';
import { User } from '../../../users/domain/entities/user.entity';
import { Session } from '../../../sessions/domain/entities/session.entity';
import { DatabaseModule } from '../../../../database/database.module';
import { CoreModule } from '../../../../../core/core.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailConfirmationCode } from '../../domain/entities/email-confirmation-code.entity';
import { PasswordRecoveryCode } from '../../domain/entities/password-recovery-code.entity';
import { SessionsRepository } from '../../../sessions/infrastructure/sessions.repository';
import { UsersRepository } from '../../../users/infrastructure/users.repository';
import { CryptoService } from '../../../users/application/services/crypto.service';
import { LoginUserCommand, LoginUserUseCase } from './login-user.usecase';
import { CreateUserDto } from '../../../users/dto/create-user.dto';
import { UserContextDto } from '../../domain/guards/dto/user-context.dto';
import { ClientInfoDto } from '../../../../../core/dto/client-info.dto';
import { AuthTokens } from '../../domain/types/auth-tokens.type';
import { JwtService } from '@nestjs/jwt';
import {
  ACCESS_TOKEN_STRATEGY_INJECT_TOKEN,
  REFRESH_TOKEN_STRATEGY_INJECT_TOKEN,
} from '../../constants/auth-tokens.inject-constants';
import { PayloadRefreshToken } from '../types/payload-refresh-token.type';
import { DateService } from '../../../users/application/services/date.service';
import { UserAccountsConfig } from '../../../config/user-accounts.config';
import { AccessTokenProvider } from '../../providers/access-token.provider';
import { RefreshTokenProvider } from '../../providers/refresh-token.provider';
import { CqrsModule } from '@nestjs/cqrs';
import { CreateSessionUseCase } from '../../../sessions/application/usecases/create-session.usecase';

describe('LoginUserUseCase (Integration)', () => {
  let module: TestingModule;
  let useCase: LoginUserUseCase;
  let dataSource: DataSource;
  let usersFactory: UsersFactory;
  let userRepo: Repository<User>;
  let sessionRepo: Repository<Session>;
  let jwtAccess: JwtService;
  let jwtRefresh: JwtService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        DatabaseModule,
        CoreModule,
        TypeOrmModule.forFeature([User, EmailConfirmationCode, PasswordRecoveryCode, Session]),
      ],
      providers: [
        UserAccountsConfig,
        CreateSessionUseCase,
        LoginUserUseCase,
        SessionsRepository,
        UsersRepository,
        UsersFactory,
        CryptoService,
        DateService,
        AccessTokenProvider,
        RefreshTokenProvider,
      ],
    }).compile();

    useCase = module.get<LoginUserUseCase>(LoginUserUseCase);
    dataSource = module.get<DataSource>(DataSource);
    usersFactory = module.get<UsersFactory>(UsersFactory);
    jwtAccess = module.get(ACCESS_TOKEN_STRATEGY_INJECT_TOKEN);
    jwtRefresh = module.get(REFRESH_TOKEN_STRATEGY_INJECT_TOKEN);
    userRepo = dataSource.getRepository<User>(User);
    sessionRepo = dataSource.getRepository<Session>(Session);
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

  describe.skip('Позитивные сценарии', () => {
    it('должен успешно авторизоваться и создать запись сессии в бд', async () => {
      const { id: userId }: User = await createTestUser('test_user', 'test_user@example.com');

      const userContextDto: UserContextDto = { id: userId };
      const clientInfoDto: ClientInfoDto = {
        ip: '1.1.1.1',
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) ' +
          'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
      };

      const { accessToken, refreshToken }: AuthTokens = await useCase.execute(
        new LoginUserCommand(userContextDto, clientInfoDto),
      );

      const verifyAcc: { id: number } = jwtAccess.verify<{ id: number }>(accessToken);
      expect(verifyAcc.id).toBe(userId);

      const verifyRef: PayloadRefreshToken = jwtRefresh.verify<PayloadRefreshToken>(refreshToken);
      expect(verifyRef.userId).toBe(userId);
      expect(typeof verifyRef.deviceId).toBe('string');

      const session: Session | null = await sessionRepo.findOneBy({ deviceId: verifyRef.deviceId });
      expect(session).toBeDefined();
      expect(session).not.toBeNull();
      expect(session!.deviceId).toBe(verifyRef.deviceId);
      expect(session!.deviceName).toBe('Mobile Safari 15.0 on iOS');
      expect(session!.ip).toBe(clientInfoDto.ip);
      expect(session!.iat).toBe(verifyRef.iat);
      expect(session!.exp).toBe(verifyRef.exp);
      expect(session!.iat.getTime()).toBeLessThan(session!.exp.getTime());
      expect(session!.userId).toBeLessThan(userId);
    });
  });
});
