import { Provider } from '@nestjs/common';
import { REFRESH_TOKEN_STRATEGY_INJECT_TOKEN } from '../constants/auth-tokens.inject-constants';
import { JwtService } from '@nestjs/jwt';
import { Configuration } from '../../../../settings/configuration/configuration';

export const RefreshTokenProvider: Provider = {
  provide: REFRESH_TOKEN_STRATEGY_INJECT_TOKEN,
  inject: [Configuration],

  useFactory: (config: Configuration): JwtService => {
    const { refreshToken } = config.apiSettings.getJwtConfig();

    return new JwtService({
      secret: refreshToken.secret,
      signOptions: {
        expiresIn: refreshToken.expiresIn,
      },
    });
  },
};
