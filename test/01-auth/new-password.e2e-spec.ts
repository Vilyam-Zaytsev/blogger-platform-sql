import { UsersTestManager } from '../managers/users.test-manager';
import { TestLoggers } from '../helpers/test.loggers';
import { AppTestManager } from '../managers/app.test-manager';
import { AdminCredentials } from '../types';
import { Server } from 'http';
import { EmailTemplate } from '../../src/modules/notifications/templates/types';
import request, { Response } from 'supertest';
import { GLOBAL_PREFIX } from '../../src/setup/global-prefix.setup';
import { TestUtils } from '../helpers/test.utils';
import { HttpStatus } from '@nestjs/common';
import { UsersRepository } from '../../src/modules/user-accounts/users/infrastructure/users.repository';
import { EmailService } from '../../src/modules/notifications/services/email.service';
import { UserViewDto } from '../../src/modules/user-accounts/users/api/view-dto/user.view-dto';
import { UserDbType } from '../../src/modules/user-accounts/users/types/user-db.type';
import { CryptoService } from '../../src/modules/user-accounts/users/application/services/crypto.service';
import SpyInstance = jest.SpyInstance;
import { PasswordRecoveryDbType } from '../../src/modules/user-accounts/auth/types/password-recovery-db.type';

describe('AuthController - newPassword() (POST: /auth/new-password)', () => {
  let appTestManager: AppTestManager;
  let usersTestManager: UsersTestManager;
  let usersRepository: UsersRepository;
  let cryptoService: CryptoService;
  let adminCredentials: AdminCredentials;
  let adminCredentialsInBase64: string;
  let testLoggingEnabled: boolean;
  let server: Server;
  let sendEmailMock: jest.Mock;
  let spy: SpyInstance;

  beforeAll(async () => {
    appTestManager = new AppTestManager();
    await appTestManager.init();

    adminCredentials = appTestManager.getAdminCredentials();
    adminCredentialsInBase64 = TestUtils.encodingAdminDataInBase64(
      adminCredentials.login,
      adminCredentials.password,
    );
    server = appTestManager.getServer();

    usersTestManager = new UsersTestManager(server, adminCredentialsInBase64);
    usersRepository = appTestManager.app.get(UsersRepository);
    cryptoService = appTestManager.app.get(CryptoService);
    testLoggingEnabled = appTestManager.coreConfig.testLoggingEnabled;

    sendEmailMock = jest
      .spyOn(EmailService.prototype, 'sendEmail')
      .mockResolvedValue() as jest.Mock<Promise<void>, [string, EmailTemplate]>;

    spy = jest.spyOn(cryptoService, 'generateUUID');
  });

  beforeEach(async () => {
    await appTestManager.cleanupDb(['schema_migrations']);

    sendEmailMock.mockClear();
    spy.mockClear();

    appTestManager.clearThrottlerStorage();
  });

  afterAll(async () => {
    await appTestManager.close();
  });

  it('should update the password if the user has sent the correct data: (newPassword, recoveryCode)', async () => {
    const [user]: UserViewDto[] = await usersTestManager.createUser(1);

    await usersTestManager.passwordRecovery(user.email);

    const userWithOldPassword: UserDbType | null =
      await usersRepository.getByEmail(user.email);

    expect(userWithOldPassword).not.toBeNull();

    if (!userWithOldPassword) {
      throw new Error(
        'Test №1: AuthController - newPassword() (POST: /auth/new-password): User not found',
      );
    }

    const passwordRecovery_1: PasswordRecoveryDbType | null =
      await usersRepository.getPasswordRecoveryByRecoveryCode(
        spy.mock.results[0].value,
      );
    expect(passwordRecovery_1).not.toBeNull();

    if (!passwordRecovery_1) {
      throw new Error(
        'Test №1: AuthController - newPassword() (POST: /auth/new-password): passwordRecovery_1 not found',
      );
    }

    expect(passwordRecovery_1).toEqual({
      userId: userWithOldPassword.id,
      recoveryCode: spy.mock.results[0].value,
      expirationDate: expect.any(Date),
    });

    const resNewPassword: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/new-password`)
      .send({
        newPassword: 'qwerty',
        recoveryCode: spy.mock.results[0].value,
      })
      .expect(HttpStatus.NO_CONTENT);

    const userWithNewPassword: UserDbType | null =
      await usersRepository.getByEmail(user.email);

    expect(userWithNewPassword).not.toBeNull();

    if (!userWithNewPassword) {
      throw new Error(
        'Test №1: AuthController - newPassword() (POST: /auth/new-password): User not found',
      );
    }

    expect(userWithOldPassword.passwordHash).not.toBe(
      userWithNewPassword.passwordHash,
    );

    const passwordRecovery_2: PasswordRecoveryDbType | null =
      await usersRepository.getPasswordRecoveryByRecoveryCode(
        spy.mock.results[0].value,
      );

    expect(passwordRecovery_2).not.toBeNull();

    if (!passwordRecovery_2) {
      throw new Error(
        'Test №1: AuthController - newPassword() (POST: /auth/new-password): passwordRecovery_2 not found',
      );
    }

    expect(passwordRecovery_2).toEqual({
      recoveryCode: null,
      expirationDate: null,
    });

    expect(sendEmailMock).toHaveBeenCalled();
    expect(sendEmailMock).toHaveBeenCalledTimes(1);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resNewPassword.body,
        resNewPassword.statusCode,
        'Test №1: AuthController - newPassword() (POST: /auth/new-password)',
      );
    }
  });

  // it('should not update the password if the user has sent incorrect data: (newPassword: less than 6 characters)', async () => {
  //   const [user]: UserViewDto[] = await usersTestManager.createUser(1);
  //
  //   await usersTestManager.passwordRecovery(user.email);
  //
  //   const found_user_1: UserDocument | null = await usersRepository.getByEmail(
  //     user.email,
  //   );
  //
  //   expect(found_user_1).not.toBeNull();
  //
  //   if (!found_user_1) {
  //     throw new Error(
  //       'Test №3: AuthController - newPassword() (POST: /auth): User not found',
  //     );
  //   }
  //
  //   expect(found_user_1).toEqual(
  //     expect.objectContaining({
  //       passwordRecovery: expect.objectContaining({
  //         recoveryCode: expect.any(String),
  //         expirationDate: expect.any(Date),
  //       }),
  //     }),
  //   );
  //
  //   const resNewPassword: Response = await request(server)
  //     .post(`/${GLOBAL_PREFIX}/auth/new-password`)
  //     .send({
  //       newPassword: 'qwert',
  //       recoveryCode: found_user_1.passwordRecovery.recoveryCode,
  //     })
  //     .expect(HttpStatus.BAD_REQUEST);
  //
  //   expect(resNewPassword.body).toEqual({
  //     errorsMessages: [
  //       {
  //         field: 'newPassword',
  //         message:
  //           'newPassword must be longer than or equal to 6 characters; Received value: qwert',
  //       },
  //     ],
  //   });
  //
  //   const found_user_2: UserDocument | null = await usersRepository.getByEmail(
  //     user.email,
  //   );
  //
  //   expect(found_user_2).not.toBeNull();
  //
  //   if (!found_user_2) {
  //     throw new Error(
  //       'Test №3: AuthController - newPassword() (POST: /auth): User not found',
  //     );
  //   }
  //
  //   expect(found_user_1.passwordRecovery).toEqual(
  //     found_user_2.passwordRecovery,
  //   );
  //
  //   expect(found_user_1.passwordHash).toBe(found_user_2.passwordHash);
  //
  //   expect(sendEmailMock).toHaveBeenCalled();
  //   expect(sendEmailMock).toHaveBeenCalledTimes(1);
  //
  //   if (testLoggingEnabled) {
  //     TestLoggers.logE2E(
  //       resNewPassword.body,
  //       resNewPassword.statusCode,
  //       'Test №3: AuthController - newPassword() (POST: /auth)',
  //     );
  //   }
  // });
  //
  // it('should not update the password if the user has sent incorrect data: (newPassword: more than 20 characters)', async () => {
  //   const [user]: UserViewDto[] = await usersTestManager.createUser(1);
  //
  //   await usersTestManager.passwordRecovery(user.email);
  //
  //   const found_user_1: UserDocument | null = await usersRepository.getByEmail(
  //     user.email,
  //   );
  //
  //   expect(found_user_1).not.toBeNull();
  //
  //   if (!found_user_1) {
  //     throw new Error(
  //       'Test №4: AuthController - newPassword() (POST: /auth): User not found',
  //     );
  //   }
  //
  //   expect(found_user_1).toEqual(
  //     expect.objectContaining({
  //       passwordRecovery: expect.objectContaining({
  //         recoveryCode: expect.any(String),
  //         expirationDate: expect.any(Date),
  //       }),
  //     }),
  //   );
  //
  //   const password: string = TestUtils.generateRandomString(21);
  //
  //   const resNewPassword: Response = await request(server)
  //     .post(`/${GLOBAL_PREFIX}/auth/new-password`)
  //     .send({
  //       newPassword: password,
  //       recoveryCode: found_user_1.passwordRecovery.recoveryCode,
  //     })
  //     .expect(HttpStatus.BAD_REQUEST);
  //
  //   expect(resNewPassword.body).toEqual({
  //     errorsMessages: [
  //       {
  //         field: 'newPassword',
  //         message: `newPassword must be shorter than or equal to 20 characters; Received value: ${password}`,
  //       },
  //     ],
  //   });
  //
  //   const found_user_2: UserDocument | null = await usersRepository.getByEmail(
  //     user.email,
  //   );
  //
  //   expect(found_user_2).not.toBeNull();
  //
  //   if (!found_user_2) {
  //     throw new Error(
  //       'Test №4: AuthController - newPassword() (POST: /auth): User not found',
  //     );
  //   }
  //
  //   expect(found_user_1.passwordRecovery).toEqual(
  //     found_user_2.passwordRecovery,
  //   );
  //
  //   expect(found_user_1.passwordHash).toBe(found_user_2.passwordHash);
  //
  //   expect(sendEmailMock).toHaveBeenCalled();
  //   expect(sendEmailMock).toHaveBeenCalledTimes(1);
  //
  //   if (testLoggingEnabled) {
  //     TestLoggers.logE2E(
  //       resNewPassword.body,
  //       resNewPassword.statusCode,
  //       'Test №4: AuthController - newPassword() (POST: /auth)',
  //     );
  //   }
  // });
  //
  // it('should not update the password if the user has sent incorrect data: (recoveryCode)', async () => {
  //   const [user]: UserViewDto[] = await usersTestManager.createUser(1);
  //
  //   await usersTestManager.passwordRecovery(user.email);
  //
  //   const found_user_1: UserDocument | null = await usersRepository.getByEmail(
  //     user.email,
  //   );
  //
  //   expect(found_user_1).not.toBeNull();
  //
  //   if (!found_user_1) {
  //     throw new Error(
  //       'Test №5: AuthController - newPassword() (POST: /auth): User not found',
  //     );
  //   }
  //
  //   expect(found_user_1).toEqual(
  //     expect.objectContaining({
  //       passwordRecovery: expect.objectContaining({
  //         recoveryCode: expect.any(String),
  //         expirationDate: expect.any(Date),
  //       }),
  //     }),
  //   );
  //
  //   const resNewPassword: Response = await request(server)
  //     .post(`/${GLOBAL_PREFIX}/auth/new-password`)
  //     .send({
  //       newPassword: 'qwerty',
  //       recoveryCode: 'incorrect-recovery-code',
  //     })
  //     .expect(HttpStatus.BAD_REQUEST);
  //
  //   const found_user_2: UserDocument | null = await usersRepository.getByEmail(
  //     user.email,
  //   );
  //
  //   expect(found_user_2).not.toBeNull();
  //
  //   if (!found_user_2) {
  //     throw new Error(
  //       'Test №5: AuthController - newPassword() (POST: /auth): User not found',
  //     );
  //   }
  //
  //   expect(found_user_1.passwordRecovery).toEqual(
  //     found_user_2.passwordRecovery,
  //   );
  //
  //   expect(found_user_1.passwordHash).toBe(found_user_2.passwordHash);
  //
  //   expect(sendEmailMock).toHaveBeenCalled();
  //   expect(sendEmailMock).toHaveBeenCalledTimes(1);
  //
  //   if (testLoggingEnabled) {
  //     TestLoggers.logE2E(
  //       resNewPassword.body,
  //       resNewPassword.statusCode,
  //       'Test №5: AuthController - newPassword() (POST: /auth)',
  //     );
  //   }
  // });
});
