import { Provider } from '@nestjs/common';
import { REFRESH_TOKEN_STRATEGY_INJECT_TOKEN } from '../constants/auth-tokens.inject-constants';
import { UserAccountsConfig } from '../../config/user-accounts.config';
import { JwtService } from '@nestjs/jwt';

export const RefreshTokenProvider: Provider = {
  provide: REFRESH_TOKEN_STRATEGY_INJECT_TOKEN,
  inject: [UserAccountsConfig],

  useFactory: (userAccountConfig: UserAccountsConfig): JwtService => {
    return new JwtService({
      secret: userAccountConfig.refreshTokenSecret,
      signOptions: {
        expiresIn: userAccountConfig.refreshTokenExpireIn,
      },
    });
  },
};
