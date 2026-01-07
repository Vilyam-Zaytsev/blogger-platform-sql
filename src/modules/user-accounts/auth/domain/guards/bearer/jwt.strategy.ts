import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { UserContextDto } from '../dto/user-context.dto';
import { Injectable } from '@nestjs/common';
import { Configuration } from '../../../../../../settings/configuration/configuration';
import { ConfigService } from '@nestjs/config';
import { ApiSettings } from '../../../../../../settings/configuration/api-settings';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly configService: ConfigService<Configuration, true>) {
    const { accessToken } = configService.get<ApiSettings>('apiSettings').getJwtConfig();

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: accessToken.secret,
    });
  }

  validate(payload: { id: number }): UserContextDto {
    return {
      id: payload.id,
    };
  }
}
