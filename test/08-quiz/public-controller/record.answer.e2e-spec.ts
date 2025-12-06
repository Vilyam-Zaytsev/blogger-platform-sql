import { AppTestManager } from '../../managers/app.test-manager';
import { AdminCredentials, TestResultLogin } from '../../types';
import { Server } from 'http';
import { TestUtils } from '../../helpers/test.utils';
import { QuizTestManager } from '../../managers/quiz.test.manager';
import { ACCESS_TOKEN_STRATEGY_INJECT_TOKEN } from '../../../src/modules/user-accounts/auth/constants/auth-tokens.inject-constants';
import { UserAccountsConfig } from '../../../src/modules/user-accounts/config/user-accounts.config';
import { JwtService } from '@nestjs/jwt';
import { UsersTestManager } from '../../managers/users.test-manager';
import { QuestionViewDto } from '../../../src/modules/quiz/admin/api/view-dto/question.view-dto';
import request from 'supertest';
import { GLOBAL_PREFIX } from '../../../src/setup/global-prefix.setup';
import { HttpStatus } from '@nestjs/common';

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

  it('', async () => {
    const questions: QuestionViewDto[] = await quizTestManager.createPublishedQuestions(5);
    const [resultLoginUser1, resultLoginUser2]: TestResultLogin[] =
      await usersTestManager.createAuthorizedUsers(2);
    const accTokenUser1: string = resultLoginUser1.authTokens.accessToken;
    const accTokenUser2: string = resultLoginUser2.authTokens.accessToken;
    await quizTestManager.connectTwoUsersToGame(accTokenUser1, accTokenUser2);

    for (let i = 0; i < questions.length; i++) {
      await request(server)
        .post(`/${GLOBAL_PREFIX}/pair-game-quiz/pairs/my-current/answers`)
        .set('Authorization', `Bearer ${accTokenUser1}`)
        .send({ answer: questions[i].correctAnswers[0] })
        .expect(HttpStatus.OK);
    }

    await new Promise((resolve) => setTimeout(resolve, 20000));
  }, 30000);
});
