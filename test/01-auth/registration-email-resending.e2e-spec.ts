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
import { EmailService } from '../../src/modules/notifications/services/email.service';
import { UserInputDto } from '../../src/modules/user-accounts/users/api/input-dto/user.input-dto';
import { UserViewDto } from '../../src/modules/user-accounts/users/api/view-dto/user.view-dto';

describe('AuthController - registrationEmailResending() (POST: /auth/registration-email-resending)', () => {
  let appTestManager: AppTestManager;
  let usersTestManager: UsersTestManager;
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

  it('should send the verification code again if the user has sent the correct data.', async () => {
    // 🔻 Генерируем один DTO пользователя с валидными данными
    const [dto]: UserInputDto[] = TestDtoFactory.generateUserInputDto(1);

    // 🔻 Регистрируем пользователя (в этом процессе уже должен быть отправлен 1 email)
    await usersTestManager.registration(dto);

    // 🔻 Выполняем повторную отправку письма с кодом подтверждения
    const resRegistrationEmailResending: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/registration-email-resending`)
      .send({
        email: dto.email, // передаём тот же email, что был при регистрации
      })
      .expect(HttpStatus.NO_CONTENT); // 🔸 Ожидаем успешный статус без тела (204)

    // 🔸 Проверяем, что письмо действительно было отправлено повторно
    expect(sendEmailMock).toHaveBeenCalled();
    expect(sendEmailMock).toHaveBeenCalledTimes(2); // 1 при регистрации + 1 при повторной отправке

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resRegistrationEmailResending.body,
        resRegistrationEmailResending.statusCode,
        'Test №1: AuthController - registrationEmailResending() (POST: /auth/registration-email-resending)',
      );
    }
  });

  it('should not resend the verification code if the user has sent incorrect data - an empty object is passed', async () => {
    // 🔻 Выполняем POST-запрос на повторную отправку письма, передавая пустой объект (некорректные данные)
    const resRegistrationEmailResending: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/registration-email-resending`)
      .send({})
      .expect(HttpStatus.BAD_REQUEST); // 🔸 Ожидаем ошибку 400 от сервера

    // 🔸 Проверяем структуру ошибки — должна быть ошибка валидации по полю email
    expect(resRegistrationEmailResending.body).toEqual({
      errorsMessages: [
        {
          field: 'email',
          message:
            'email must match /^[\\w.-]+@([\\w-]+\\.)+[\\w-]{2,4}$/ regular expression; Received value: undefined',
        },
      ],
    });

    // 🔸 Убедимся, что письмо не было отправлено вообще
    expect(sendEmailMock).toHaveBeenCalledTimes(0);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resRegistrationEmailResending.body,
        resRegistrationEmailResending.statusCode,
        'Test №3: AuthController - registrationEmailResending() (POST: /auth/registration-email-resending)',
      );
    }
  });

  it('should not resend the verification code if the user has sent incorrect data - email: empty line', async () => {
    // 🔻 Отправляем запрос на повторную отправку письма, передавая строку из пробелов вместо email
    const resRegistrationEmailResending: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/registration-email-resending`)
      .send({
        email: '   ', // строка из пробелов — невалидный email
      })
      .expect(HttpStatus.BAD_REQUEST); // 🔸 Ожидаем ошибку 400 от сервера

    // 🔸 Проверяем, что сервер вернул ошибку валидации по полю email
    expect(resRegistrationEmailResending.body).toEqual({
      errorsMessages: [
        {
          field: 'email',
          message:
            'email must match /^[\\w.-]+@([\\w-]+\\.)+[\\w-]{2,4}$/ regular expression; Received value: ',
        },
      ],
    });

    // 🔸 Убеждаемся, что письмо с кодом не было отправлено
    expect(sendEmailMock).toHaveBeenCalledTimes(0);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resRegistrationEmailResending.body,
        resRegistrationEmailResending.statusCode,
        'Test №4: AuthController - registrationEmailResending() (POST: /auth/registration-email-resending)',
      );
    }
  });

  it('should not resend the verification code if the user has sent incorrect data - email: incorrect', async () => {
    // 🔻 Генерируем случайную строку, не являющуюся корректным email
    const email: string = TestUtils.generateRandomString(10); // например: "xks92ndkeq"

    // 🔻 Выполняем POST-запрос на повторную отправку письма с невалидным email
    const resRegistrationEmailResending: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/registration-email-resending`)
      .send({
        email, // передаём явно некорректный email (без "@" и домена)
      })
      .expect(HttpStatus.BAD_REQUEST); // 🔸 Ожидаем ошибку 400

    // 🔸 Проверяем, что в ответе содержится сообщение об ошибке валидации email
    expect(resRegistrationEmailResending.body).toEqual({
      errorsMessages: [
        {
          field: 'email',
          message: `email must match /^[\\w.-]+@([\\w-]+\\.)+[\\w-]{2,4}$/ regular expression; Received value: ${email}`,
        },
      ],
    });

    // 🔸 Убеждаемся, что письмо с кодом не было отправлено
    expect(sendEmailMock).toHaveBeenCalledTimes(0);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resRegistrationEmailResending.body,
        resRegistrationEmailResending.statusCode,
        'Test №5: AuthController - registrationEmailResending() (POST: /auth/registration-email-resending)',
      );
    }
  });

  it('should not resend the verification code if the user has sent incorrect data - email: type number', async () => {
    // 🔻 Выполняем POST-запрос, где email передаётся как число (тип number, а не string)
    const resRegistrationEmailResending: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/registration-email-resending`)
      .send({
        email: 123, // 🔸 Неверный тип — ожидается строка, а передано число
      })
      .expect(HttpStatus.BAD_REQUEST); // 🔸 Ожидаем ошибку 400

    // 🔸 Проверяем тело ответа — должна прийти ошибка с указанием некорректного значения
    expect(resRegistrationEmailResending.body).toEqual({
      errorsMessages: [
        {
          field: 'email',
          message: `email must match /^[\\w.-]+@([\\w-]+\\.)+[\\w-]{2,4}$/ regular expression; Received value: 123`,
        },
      ],
    });

    // 🔸 Убеждаемся, что письмо не было отправлено
    expect(sendEmailMock).toHaveBeenCalledTimes(0);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resRegistrationEmailResending.body,
        resRegistrationEmailResending.statusCode,
        'Test №6: AuthController - registrationEmailResending() (POST: /auth/registration-email-resending)',
      );
    }
  });

  it('should not resend the verification code if the user has already confirmed the account', async () => {
    // 🔻 Создаём пользователя с уже подтверждённым email
    const [user]: UserViewDto[] = await usersTestManager.createUser(1);

    // 🔻 Пытаемся повторно отправить письмо с подтверждением
    const resRegistrationEmailResending: Response = await request(server)
      .post(`/${GLOBAL_PREFIX}/auth/registration-email-resending`)
      .send({
        email: user.email,
      })
      .expect(HttpStatus.BAD_REQUEST); // 🔸 Ожидаем ошибку 400

    // 🔸 Проверяем, что вернулась корректная ошибка
    expect(resRegistrationEmailResending.body).toEqual({
      errorsMessages: [
        {
          message: `The email address (${user.email}) has already been verified`,
          field: 'email',
        },
      ],
    });

    // 🔸 Убеждаемся, что письмо повторно не отправлено
    expect(sendEmailMock).toHaveBeenCalledTimes(0);

    if (testLoggingEnabled) {
      TestLoggers.logE2E(
        resRegistrationEmailResending.body,
        resRegistrationEmailResending.statusCode,
        'Test №7: AuthController - registrationEmailResending() (POST: /auth/registration-email-resending)',
      );
    }
  });
});
