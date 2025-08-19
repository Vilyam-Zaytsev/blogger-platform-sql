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
import { CryptoService } from '../../src/modules/user-accounts/users/application/services/crypto.service';

describe('AuthController - registrationConfirmation() (POST: /auth/registration-confirmation)', () => {
  let appTestManager: AppTestManager;
  let usersTestManager: UsersTestManager;
  let usersRepository: UsersRepository;
  let cryptoService: CryptoService;
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
    cryptoService = appTestManager.app.get(CryptoService);

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

  it('should not confirm the email if the user has sent more than 5 requests from one IP to "/login/registration-confirmation" in the last 10 seconds.', async () => {
    // 🔻 Создаём шпион на метод генерации UUID для доступа к сгенерированным кодам подтверждения
    const spy = jest.spyOn(cryptoService, 'generateUUID');

    // 🔻 Генерируем массив из 5 DTO пользователей
    const dtos: UserInputDto[] = TestDtoFactory.generateUserInputDto(5);

    // 🔻 Регистрируем 5 пользователей
    for (let i = 0; i < dtos.length; i++) {
      await usersTestManager.registration(dtos[i]);
    }

    // 🔻 Отправляем 5 успешных запросов на подтверждение email с корректными кодами подтверждения
    for (let i = 0; i < 5; i++) {
      await request(server)
        .post(`/${GLOBAL_PREFIX}/auth/registration-confirmation`)
        .send({
          code: spy.mock.results[i].value, // 🔸 используем код подтверждения из вызова generateUUID()
        })
        .expect(HttpStatus.NO_CONTENT); // 🔸 Ожидаем статус 204 (успешно, без контента)
    }

    // 🔻 Отправляем 6-й запрос на подтверждение email с новым (неизвестным) UUID
    const resRegistrationConfirmation = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/registration-confirmation`)
      .send({
        code: cryptoService.generateUUID(), // 🔸 фейковый код, чтобы точно не сработал
      })
      .expect(HttpStatus.TOO_MANY_REQUESTS); // 🔸 Ожидаем статус 429 (слишком много запросов)

    // 🔸 Проверяем, что почтовый сервис вызывался ровно 5 раз (только для успешных регистраций)
    expect(sendEmailMock).toHaveBeenCalled();
    expect(sendEmailMock).toHaveBeenCalledTimes(5);

    spy.mockClear();

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resRegistrationConfirmation.body,
        resRegistrationConfirmation.statusCode,
        'Test №2: AuthController - registrationConfirmation() (POST: /auth/registration-confirmation)',
      );
    }
  });

  it('should not be confirmed if the user has sent an incorrect verification code.', async () => {
    // 🔻 Создаём шпион на метод generateUUID, чтобы отследить реальный код подтверждения
    const spy = jest.spyOn(cryptoService, 'generateUUID');

    // 🔻 Генерируем случайную строку, которая будет использоваться как некорректный код подтверждения
    const incorrectCode: string = TestUtils.generateRandomString(15);

    // 🔻 Создаём одного пользователя (массив из 1 DTO)
    const [dto]: UserInputDto[] = TestDtoFactory.generateUserInputDto(1);

    // 🔻 Регистрируем пользователя (в базе создастся подтверждение email с UUID из spy)
    await usersTestManager.registration(dto);

    // 🔻 Отправляем запрос на подтверждение регистрации с некорректным кодом
    const resRegistrationConfirmation: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/registration-confirmation`)
      .send({
        code: incorrectCode, // 🔸 Передаём несуществующий код
      })
      .expect(HttpStatus.BAD_REQUEST); // 🔸 Ожидаем 400 — ошибка валидации кода

    // 🔸 Проверяем, что тело ответа содержит сообщение об ошибке с указанием поля "code"
    expect(resRegistrationConfirmation.body).toEqual({
      errorsMessages: [
        {
          message: `Confirmation code (${incorrectCode}) incorrect or the email address has already been confirmed`,
          field: 'code',
        },
      ],
    });

    // 🔻 Получаем из базы информацию о подтверждении email по реальному коду из spy
    const emailConfirmation: EmailConfirmationDbType | null =
      await usersRepository.getEmailConfirmationByConfirmationCode(
        spy.mock.results[0].value, // 🔸 именно тот код, который система сгенерировала
      );

    // 🔸 Проверяем, что подтверждение email всё ещё не завершено (confirmationStatus: NotConfirmed)
    expect(emailConfirmation).toEqual({
      userId: expect.any(Number),
      confirmationCode: spy.mock.results[0].value,
      expirationDate: expect.any(Date),
      confirmationStatus: ConfirmationStatus.NotConfirmed,
    });

    // 🔸 Проверяем, что письмо с подтверждением отправлялось (один раз)
    expect(sendEmailMock).toHaveBeenCalled();
    expect(sendEmailMock).toHaveBeenCalledTimes(1);

    spy.mockClear();

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resRegistrationConfirmation.body,
        resRegistrationConfirmation.statusCode,
        'Test №3: AuthController - registrationConfirmation() (POST: /auth/registration-confirmation)',
      );
    }
  });

  it('should not be confirmed if the user has sent an incorrect verification code (the code has already been used)', async () => {
    // 🔻 Генерируем DTO пользователя для регистрации
    const [dto]: UserInputDto[] = TestDtoFactory.generateUserInputDto(1);

    // 🔸 Регистрируем пользователя
    await usersTestManager.registration(dto);

    // 🔻 Получаем пользователя из базы данных по email
    const user_NotConfirmed: UserDbType | null = await usersRepository.getByEmail(dto.email);
    expect(user_NotConfirmed).not.toBeNull(); // 🔸 Проверяем, что пользователь существует

    if (!user_NotConfirmed) {
      throw new Error(
        'Test №4: AuthController - registrationConfirmation() (POST: /auth/registration-confirmation): User not found',
      );
    }

    // 🔻 Получаем сущность email-подтверждения по userId
    const emailConfirmation_NotConfirmed: EmailConfirmationDbType | null =
      await usersRepository.getEmailConfirmationByUserId(user_NotConfirmed.id);

    if (!emailConfirmation_NotConfirmed) {
      throw new Error(
        'Test №4: AuthController - registrationConfirmation() (POST: /auth/registration-confirmation): EmailConfirmation not found',
      );
    }

    // 🔸 Проверяем, что email еще не подтверждён
    expect(emailConfirmation_NotConfirmed).toEqual({
      userId: user_NotConfirmed.id,
      confirmationCode: expect.any(String),
      expirationDate: expect.any(Date),
      confirmationStatus: ConfirmationStatus.NotConfirmed,
    });

    // 🔻 Отправляем корректный код подтверждения (первое подтверждение)
    await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/registration-confirmation`)
      .send({
        code: emailConfirmation_NotConfirmed.confirmationCode,
      })
      .expect(HttpStatus.NO_CONTENT); // 🔸 Ожидаем успешное подтверждение

    // 🔻 Повторно получаем emailConfirmation из базы данных
    const emailConfirmation_Confirmed: EmailConfirmationDbType | null =
      await usersRepository.getEmailConfirmationByUserId(user_NotConfirmed.id);

    if (!emailConfirmation_Confirmed) {
      throw new Error(
        'Test №4: AuthController - registrationConfirmation() (POST: /auth/registration-confirmation): EmailConfirmation not found',
      );
    }

    // 🔸 Проверяем, что код и дата подтверждения сброшены, а статус — Confirmed
    expect(emailConfirmation_Confirmed).toEqual({
      userId: user_NotConfirmed.id,
      confirmationCode: null,
      expirationDate: null,
      confirmationStatus: ConfirmationStatus.Confirmed,
    });

    // 🔻 Повторная попытка подтверждения тем же кодом (он уже использован)
    const resRegistrationConfirmation: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/registration-confirmation`)
      .send({
        code: emailConfirmation_NotConfirmed.confirmationCode,
      })
      .expect(HttpStatus.BAD_REQUEST); // 🔸 Ожидаем 400 Bad Request

    // 🔸 Проверяем тело ответа: ожидается ошибка с указанием поля `code`
    expect(resRegistrationConfirmation.body).toEqual({
      errorsMessages: [
        {
          message: `Confirmation code (${emailConfirmation_NotConfirmed.confirmationCode}) incorrect or the email address has already been confirmed`,
          field: 'code',
        },
      ],
    });

    // 🔸 Проверяем, что письмо отправлялось один раз — только на этапе регистрации
    expect(sendEmailMock).toHaveBeenCalled();
    expect(sendEmailMock).toHaveBeenCalledTimes(1);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resRegistrationConfirmation.body,
        resRegistrationConfirmation.statusCode,
        'Test №4: AuthController - registrationConfirmation() (POST: /auth/registration-confirmation)',
      );
    }
  });
});
