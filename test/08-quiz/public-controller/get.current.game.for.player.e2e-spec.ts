import { AppTestManager } from '../../managers/app.test-manager';
import { AdminCredentials } from '../../types';
import { Server } from 'http';
import { TestUtils } from '../../helpers/test.utils';
import { QuizTestManager } from '../../managers/quiz.test.manager';
import { ACCESS_TOKEN_STRATEGY_INJECT_TOKEN } from '../../../src/modules/user-accounts/auth/constants/auth-tokens.inject-constants';
import { UserAccountsConfig } from '../../../src/modules/user-accounts/config/user-accounts.config';
import { JwtService } from '@nestjs/jwt';
import { UsersTestManager } from '../../managers/users.test-manager';

describe('QuestionsAdminController - createQuestion() (POST: /sa/quiz/questions)', () => {
  let appTestManager: AppTestManager;
  let quizTestManager: QuizTestManager;
  let usersTestManager: UsersTestManager;
  let adminCredentials: AdminCredentials;
  let adminCredentialsInBase64: string;
  let testLoggingEnabled: boolean;
  let server: Server;

  beforeAll(async () => {
    appTestManager = new AppTestManager();
    await appTestManager.init((moduleBuilder) =>
      moduleBuilder.overrideProvider(ACCESS_TOKEN_STRATEGY_INJECT_TOKEN).useFactory({
        factory: (userAccountsConfig: UserAccountsConfig) => {
          return new JwtService({
            secret: userAccountsConfig.accessTokenSecret,
            signOptions: { expiresIn: '3s' },
          });
        },
        inject: [UserAccountsConfig],
      }),
    );

    adminCredentials = appTestManager.getAdminCredentials();
    adminCredentialsInBase64 = TestUtils.encodingAdminDataInBase64(
      adminCredentials.login,
      adminCredentials.password,
    );
    server = appTestManager.getServer();
    testLoggingEnabled = appTestManager.coreConfig.testLoggingEnabled;

    quizTestManager = new QuizTestManager(server, adminCredentialsInBase64);
    usersTestManager = new UsersTestManager(server, adminCredentialsInBase64);
  });

  beforeEach(async () => {
    await appTestManager.cleanupDb(['migrations']);
  });

  afterAll(async () => {
    await appTestManager.close();
  });

  // it('должен вернуть текущею игру пользователя если он участвует в активной игре или ожидает соперника', async () => {
  //   await quizTestManager.createPublishedQuestions(5);
  //   const resultLogins: TestResultLogin[] = await usersTestManager.createAuthorizedUsers(1);
  //   const game: Game =
  // });
});
