import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { UserContextDto } from '../dto/user-context.dto';
import { Injectable } from '@nestjs/common';
import { Configuration } from '../../../../../../settings/configuration/configuration';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly config: Configuration) {
    const { accessToken } = config.apiSettings.getJwtConfig();

    if (!accessToken.secret) {
      throw new Error('ACCESS_TOKEN_SECRET is not defined in environment variables');
    }

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
