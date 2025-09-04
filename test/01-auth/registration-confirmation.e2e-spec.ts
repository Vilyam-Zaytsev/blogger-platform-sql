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
import { CryptoService } from '../../src/modules/user-accounts/users/application/services/crypto.service';
import { ConfirmationStatus } from '../../src/modules/user-accounts/auth/domain/entities/email-confirmation-code.entity';
import { User } from '../../src/modules/user-accounts/users/domain/entities/user.entity';

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
    // 🔻 Генерируем данные для регистрации пользователя
    const [dto]: UserInputDto[] = TestDtoFactory.generateUserInputDto(1);

    // 🔻 Регистрируем пользователя
    await usersTestManager.registration(dto);

    // 🔻 Получаем пользователя из БД вместе с кодом подтверждения
    const user_NotConfirmed: User | null =
      await usersRepository.getByEmailWithEmailConfirmationCode(dto.email);
    expect(user_NotConfirmed).not.toBeNull();

    if (!user_NotConfirmed) {
      throw new Error(
        'Test №1: AuthController - registrationConfirmation() (POST: /auth/registration-confirmation): User not found',
      );
    }

    // 🔻 Проверяем, что у пользователя есть код подтверждения и статус "Не подтверждён"
    expect(user_NotConfirmed.emailConfirmationCode).toMatchObject({
      confirmationCode: expect.any(String),
      expirationDate: expect.any(Date),
      confirmationStatus: ConfirmationStatus.NotConfirmed,
    });

    // 🔻 Отправляем POST-запрос с корректным кодом подтверждения, ожидаем 204 No Content
    const resRegistrationConfirmation: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/registration-confirmation`)
      .send({
        code: user_NotConfirmed.emailConfirmationCode.confirmationCode,
      })
      .expect(HttpStatus.NO_CONTENT);

    // 🔻 Получаем пользователя заново из БД после подтверждения
    const user_Confirmed: User | null = await usersRepository.getByEmailWithEmailConfirmationCode(
      dto.email,
    );
    expect(user_Confirmed).not.toBeNull();

    if (!user_Confirmed) {
      throw new Error(
        'Test №1: AuthController - registrationConfirmation() (POST: /auth/registration-confirmation): User not found',
      );
    }

    // 🔻 Проверяем, что код подтверждения сброшен и статус изменён на "Подтверждён"
    expect(user_Confirmed.emailConfirmationCode).toMatchObject({
      confirmationCode: null,
      expirationDate: null,
      confirmationStatus: ConfirmationStatus.Confirmed,
    });

    // 🔻 Проверяем, что отправка письма была выполнена один раз
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
    // 🔻 Создаём шпион на метод генерации UUID, чтобы отслеживать коды подтверждения
    const spy = jest.spyOn(cryptoService, 'generateUUID');

    // 🔻 Генерируем данные для регистрации 5 пользователей
    const dtos: UserInputDto[] = TestDtoFactory.generateUserInputDto(5);

    // 🔻 Регистрируем каждого пользователя
    for (let i = 0; i < dtos.length; i++) {
      await usersTestManager.registration(dtos[i]);
    }

    // 🔻 Отправляем 5 запросов на подтверждение с кодами из шпиона, ожидаем 204 No Content
    for (let i = 0; i < 5; i++) {
      await request(server)
        .post(`/${GLOBAL_PREFIX}/auth/registration-confirmation`)
        .send({
          code: spy.mock.results[i].value,
        })
        .expect(HttpStatus.NO_CONTENT);
    }

    // 🔻 Отправляем 6-й запрос с новым сгенерированным кодом, ожидаем 429 Too Many Requests
    const resRegistrationConfirmation = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/registration-confirmation`)
      .send({
        code: cryptoService.generateUUID(),
      })
      .expect(HttpStatus.TOO_MANY_REQUESTS);

    // 🔻 Проверяем, что отправка письма была выполнена ровно 5 раз
    expect(sendEmailMock).toHaveBeenCalled();
    expect(sendEmailMock).toHaveBeenCalledTimes(5);

    // 🔻 Очищаем мок шпиона
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
        code: incorrectCode,
      })
      .expect(HttpStatus.BAD_REQUEST);

    // 🔸 Проверяем, что тело ответа содержит сообщение об ошибке с указанием поля "code"
    expect(resRegistrationConfirmation.body).toEqual({
      errorsMessages: [
        {
          message: `Confirmation code (${incorrectCode}) incorrect or the email address has already been confirmed`,
          field: 'code',
        },
      ],
    });

    // 🔻 Получаем пользователя из БД вместе с кодом подтверждения
    const user_NotConfirmed: User | null =
      await usersRepository.getByEmailWithEmailConfirmationCode(dto.email);
    expect(user_NotConfirmed).not.toBeNull();

    if (!user_NotConfirmed) {
      throw new Error(
        'Test №1: AuthController - registrationConfirmation() (POST: /auth/registration-confirmation): User not found',
      );
    }

    // 🔸 Проверяем, что подтверждение email всё ещё не завершено (confirmationStatus: NotConfirmed)
    expect(user_NotConfirmed.emailConfirmationCode).toMatchObject({
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

    // 🔻 Получаем пользователя из БД вместе с кодом подтверждения
    const user_NotConfirmed: User | null =
      await usersRepository.getByEmailWithEmailConfirmationCode(dto.email);
    expect(user_NotConfirmed).not.toBeNull();

    if (!user_NotConfirmed) {
      throw new Error(
        'Test №1: AuthController - registrationConfirmation() (POST: /auth/registration-confirmation): User not found',
      );
    }

    // 🔸 Проверяем, что подтверждение email всё ещё не завершено (confirmationStatus: NotConfirmed)
    expect(user_NotConfirmed.emailConfirmationCode).toMatchObject({
      confirmationCode: expect.any(String),
      expirationDate: expect.any(Date),
      confirmationStatus: ConfirmationStatus.NotConfirmed,
    });

    // 🔻 Отправляем корректный код подтверждения (первое подтверждение)
    await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/registration-confirmation`)
      .send({
        code: user_NotConfirmed.emailConfirmationCode.confirmationCode,
      })
      .expect(HttpStatus.NO_CONTENT);

    // 🔻 Получаем пользователя заново из БД после подтверждения
    const user_Confirmed: User | null = await usersRepository.getByEmailWithEmailConfirmationCode(
      dto.email,
    );
    expect(user_Confirmed).not.toBeNull();

    if (!user_Confirmed) {
      throw new Error(
        'Test №1: AuthController - registrationConfirmation() (POST: /auth/registration-confirmation): User not found',
      );
    }

    // 🔻 Проверяем, что код подтверждения сброшен и статус изменён на "Подтверждён"
    expect(user_Confirmed.emailConfirmationCode).toMatchObject({
      confirmationCode: null,
      expirationDate: null,
      confirmationStatus: ConfirmationStatus.Confirmed,
    });

    // 🔻 Повторная попытка подтверждения тем же кодом (он уже использован)
    const resRegistrationConfirmation: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/registration-confirmation`)
      .send({
        code: user_NotConfirmed.emailConfirmationCode.confirmationCode,
      })
      .expect(HttpStatus.BAD_REQUEST);

    // 🔸 Проверяем тело ответа: ожидается ошибка с указанием поля `code`
    expect(resRegistrationConfirmation.body).toEqual({
      errorsMessages: [
        {
          message: `Confirmation code (${user_NotConfirmed.emailConfirmationCode.confirmationCode}) incorrect or the email address has already been confirmed`,
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
