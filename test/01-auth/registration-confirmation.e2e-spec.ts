import request, { Response } from 'supertest';
import { TestDtoFactory } from '../helpers/test.dto-factory';
import { UsersTestManager } from '../managers/users.test-manager';
import { GLOBAL_PREFIX } from '../../src/setup/global-prefix.setup';
import { TestLoggers } from '../helpers/test.loggers';
import { AppTestManager } from '../managers/app.test-manager';
import { AdminCredentials } from '../types';
import { Server } from 'http';
import { EmailTemplate } from '../../src/modules/notifications/templates/types';
import { TestUtils } from '../helpers/test.utils';
import { HttpStatus } from '@nestjs/common';
import { UsersRepository } from '../../src/modules/user-accounts/users/infrastructure/users.repository';
import { EmailService } from '../../src/modules/notifications/services/email.service';
import { UserInputDto } from '../../src/modules/user-accounts/users/api/input-dto/user.input-dto';
import { UserDbType } from '../../src/modules/user-accounts/users/types/user-db.type';
import {
  ConfirmationStatus,
  EmailConfirmationDbType,
} from '../../src/modules/user-accounts/auth/types/email-confirmation-db.type';
import { PaginatedViewDto } from '../../src/core/dto/paginated.view-dto';
import { UserViewDto } from '../../src/modules/user-accounts/users/api/view-dto/user.view-dto';

describe('AuthController - registrationConfirmation() (POST: /auth/registration-confirmation)', () => {
  let appTestManager: AppTestManager;
  let usersTestManager: UsersTestManager;
  let usersRepository: UsersRepository;
  let adminCredentials: AdminCredentials;
  let adminCredentialsInBase64: string;
  let testLoggingEnabled: boolean;
  let server: Server;
  let sendEmailMock: jest.Mock;

  beforeAll(async () => {
    appTestManager = new AppTestManager();
    await appTestManager.init();

    adminCredentials = appTestManager.getAdminCredentials();
    adminCredentialsInBase64 = TestUtils.encodingAdminDataInBase64(
      adminCredentials.login,
      adminCredentials.password,
    );
    server = appTestManager.getServer();
    testLoggingEnabled = appTestManager.coreConfig.testLoggingEnabled;

    usersTestManager = new UsersTestManager(server, adminCredentialsInBase64);
    usersRepository = appTestManager.app.get(UsersRepository);

    sendEmailMock = jest
      .spyOn(EmailService.prototype, 'sendEmail')
      .mockResolvedValue() as jest.Mock<Promise<void>, [string, EmailTemplate]>;
  });

  beforeEach(async () => {
    await appTestManager.cleanupDb(['schema_migrations']);

    sendEmailMock.mockClear();

    appTestManager.clearThrottlerStorage();
  });

  afterAll(async () => {
    await appTestManager.close();
  });

  it('should be confirmed if the user has sent the correct verification code.', async () => {
    // 🔻 Создаем валидные данные для регистрации
    const [dto]: UserInputDto[] = TestDtoFactory.generateUserInputDto(1);

    // 🔻 Регистрируем пользователя через менеджер
    await usersTestManager.registration(dto);

    // 🔻 Получаем созданного пользователя из базы по email
    const user: UserDbType | null = await usersRepository.getByEmail(dto.email);
    expect(user).not.toBeNull();

    if (!user) {
      throw new Error(
        'Test №1: AuthController - registrationConfirmation() (POST: /auth/registration-confirmation): User not found',
      );
    }

    // 🔻 Проверяем наличие записи подтверждения email в статусе NotConfirmed
    const emailConfirmationRecord_NotConfirmed: EmailConfirmationDbType | null =
      await usersRepository.getEmailConfirmationByUserId(user.id);

    expect(emailConfirmationRecord_NotConfirmed).toEqual({
      userId: user.id,
      confirmationCode: expect.any(String),
      expirationDate: expect.any(Date),
      confirmationStatus: ConfirmationStatus.NotConfirmed,
    });

    if (!emailConfirmationRecord_NotConfirmed) {
      throw new Error(
        `Test №1: AuthController - registrationConfirmation() (POST: /auth/registration-confirmation): Registration confirmation error. The email confirmation record was not found for the user with the ID: ${user.id}`,
      );
    }

    // 🔻 Подтверждаем email пользователя
    const resRegistrationConfirmation: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/registration-confirmation`)
      .send({
        code: emailConfirmationRecord_NotConfirmed.confirmationCode,
      })
      .expect(HttpStatus.NO_CONTENT);

    // 🔻 Проверяем обновление статуса подтверждения email
    const emailConfirmationRecord_Confirmed: EmailConfirmationDbType | null =
      await usersRepository.getEmailConfirmationByUserId(user.id);

    expect(emailConfirmationRecord_Confirmed).toEqual({
      userId: user.id,
      confirmationCode: null,
      expirationDate: null,
      confirmationStatus: ConfirmationStatus.Confirmed,
    });

    // 🔻 Проверяем, что email был отправлен один раз
    expect(sendEmailMock).toHaveBeenCalled();
    expect(sendEmailMock).toHaveBeenCalledTimes(1);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resRegistrationConfirmation.body,
        resRegistrationConfirmation.statusCode,
        'Test №1: AuthController - registrationConfirmation() (POST: /auth/registration-confirmation)',
      );
    }
  });

  it.only('should not confirm the email if the user has sent more than 5 requests from one IP to "/login/registration-confirmation" in the last 10 seconds.', async () => {
    const dtos: UserInputDto[] = TestDtoFactory.generateUserInputDto(6);

    for (let i = 0; i < dtos.length; i++) {
      await usersTestManager.registration(dtos[i]);
    }

    const { items }: PaginatedViewDto<UserViewDto> =
      await usersTestManager.getAll();

    const confirmationCodes: string[] = items.map(
      (user) => u.emailConfirmation.confirmationCode!,
    );

    const emailConfirmationRecord_NotConfirmed: EmailConfirmationDbType | null =
      await usersRepository.getEmailConfirmationByUserId(user.id);

    expect(emailConfirmationRecord_NotConfirmed).toEqual({
      userId: user.id,
      confirmationCode: expect.any(String),
      expirationDate: expect.any(Date),
      confirmationStatus: ConfirmationStatus.NotConfirmed,
    });

    if (!emailConfirmationRecord_NotConfirmed) {
      throw new Error(
        `Test №1: AuthController - registrationConfirmation() (POST: /auth/registration-confirmation): Registration confirmation error. The email confirmation record was not found for the user with the ID: ${user.id}`,
      );
    }

    // 🔻 Подтверждаем email пользователя
    for (let i = 0; i < 5; i++) {
      await request(server)
        .post(`/${GLOBAL_PREFIX}/auth/registration-confirmation`)
        .send({
          code: emailConfirmationRecord_NotConfirmed.confirmationCode,
        })
        .expect(HttpStatus.NO_CONTENT);
    }

    await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/registration-confirmation`)
      .send({
        code: emailConfirmationRecord_NotConfirmed.confirmationCode,
      })
      .expect(HttpStatus.TOO_MANY_REQUESTS);

    // 🔻 Проверяем обновление статуса подтверждения email
    const emailConfirmationRecord_Confirmed: EmailConfirmationDbType | null =
      await usersRepository.getEmailConfirmationByUserId(user.id);

    expect(emailConfirmationRecord_Confirmed).toEqual({
      userId: user.id,
      confirmationCode: null,
      expirationDate: null,
      confirmationStatus: ConfirmationStatus.Confirmed,
    });

    // 🔻 Проверяем, что email был отправлен один раз
    expect(sendEmailMock).toHaveBeenCalled();
    expect(sendEmailMock).toHaveBeenCalledTimes(1);

    // if (testLoggingEnabled) {
    //   TestLoggers.logE2E(
    //     resRegistrationConfirmation.body,
    //     resRegistrationConfirmation.statusCode,
    //     'Test №1: AuthController - registrationConfirmation() (POST: /auth/registration-confirmation)',
    //   );
    // }
  });

  // it('should not be confirmed if the user has sent an incorrect verification code.', async () => {
  //   const code: string = TestUtils.generateRandomString(15);
  //
  //   const [dto]: UserInputDto[] = TestDtoFactory.generateUserInputDto(1);
  //
  //   await usersTestManager.registration(dto);
  //
  //   const resRegistrationConfirmation: Response = await request(server)
  //     .post(`/${GLOBAL_PREFIX}/auth/registration-confirmation`)
  //     .send({
  //       code,
  //     })
  //     .expect(HttpStatus.BAD_REQUEST);
  //
  //   expect(resRegistrationConfirmation.body).toEqual({
  //     errorsMessages: [
  //       {
  //         message: `Confirmation code (${code}) incorrect or the email address has already been confirmed`,
  //         field: 'code',
  //       },
  //     ],
  //   });
  //
  //   const user: UserDocument | null = await usersRepository.getByEmail(
  //     dto.email,
  //   );
  //
  //   expect(user).not.toBeNull();
  //
  //   if (!user) {
  //     throw new Error(
  //       'Test №3: AuthController - registrationConfirmation() (POST: /auth): User not found',
  //     );
  //   }
  //
  //   expect(user).toEqual(
  //     expect.objectContaining({
  //       emailConfirmation: expect.objectContaining({
  //         confirmationCode: expect.any(String),
  //         expirationDate: expect.any(Date),
  //         confirmationStatus: ConfirmationStatus.NotConfirmed,
  //       }),
  //     }),
  //   );
  //
  //   expect(sendEmailMock).toHaveBeenCalled();
  //   expect(sendEmailMock).toHaveBeenCalledTimes(1);
  //
  //   if (testLoggingEnabled) {
  //     TestLoggers.logE2E(
  //       resRegistrationConfirmation.body,
  //       resRegistrationConfirmation.statusCode,
  //       'Test №3: AuthController - registrationConfirmation() (POST: /auth)',
  //     );
  //   }
  // });
  //
  // it('should not be confirmed if the user has sent an incorrect verification code (the code has already been used', async () => {
  //   const [dto]: UserInputDto[] = TestDtoFactory.generateUserInputDto(1);
  //
  //   await usersTestManager.registration(dto);
  //
  //   const user_notConfirmed: UserDocument | null =
  //     await usersRepository.getByEmail(dto.email);
  //
  //   expect(user_notConfirmed).not.toBeNull();
  //
  //   if (!user_notConfirmed) {
  //     throw new Error(
  //       'Test №4: AuthController - registrationConfirmation() (POST: /auth): User not found',
  //     );
  //   }
  //
  //   expect(user_notConfirmed).toEqual(
  //     expect.objectContaining({
  //       emailConfirmation: expect.objectContaining({
  //         confirmationCode: expect.any(String),
  //         expirationDate: expect.any(Date),
  //         confirmationStatus: ConfirmationStatus.NotConfirmed,
  //       }),
  //     }),
  //   );
  //
  //   await request(server)
  //     .post(`/${GLOBAL_PREFIX}/auth/registration-confirmation`)
  //     .send({
  //       code: user_notConfirmed.emailConfirmation.confirmationCode,
  //     })
  //     .expect(HttpStatus.NO_CONTENT);
  //
  //   const user: UserDocument | null = await usersRepository.getByEmail(
  //     dto.email,
  //   );
  //
  //   expect(user).not.toBeNull();
  //
  //   if (!user) {
  //     throw new Error(
  //       'Test №4: AuthController - registrationConfirmation() (POST: /auth): User not found',
  //     );
  //   }
  //
  //   expect(user).toEqual(
  //     expect.objectContaining({
  //       emailConfirmation: expect.objectContaining({
  //         confirmationCode: null,
  //         expirationDate: null,
  //         confirmationStatus: ConfirmationStatus.Confirmed,
  //       }),
  //     }),
  //   );
  //
  //   const resRegistrationConfirmation: Response = await request(server)
  //     .post(`/${GLOBAL_PREFIX}/auth/registration-confirmation`)
  //     .send({
  //       code: user_notConfirmed.emailConfirmation.confirmationCode,
  //     })
  //     .expect(HttpStatus.BAD_REQUEST);
  //
  //   expect(sendEmailMock).toHaveBeenCalled();
  //   expect(sendEmailMock).toHaveBeenCalledTimes(1);
  //
  //   if (testLoggingEnabled) {
  //     TestLoggers.logE2E(
  //       resRegistrationConfirmation.body,
  //       resRegistrationConfirmation.statusCode,
  //       'Test №4: AuthController - registrationConfirmation() (POST: /auth)',
  //     );
  //   }
  // });
});
