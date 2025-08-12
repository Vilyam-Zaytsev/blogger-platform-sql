import { OmitType } from '@nestjs/swagger';
import { UserDbType } from '../../types/user-db.type';

export class UserViewDto {
  id: string;
  email: string;
  login: string;
  createdAt: string;

  static mapToView(user: UserDbType): UserViewDto {
    const dto = new this();

    dto.id = user.id.toString();
    dto.login = user.login;
    dto.email = user.email;
    dto.createdAt = user.createdAt;

    return dto;
  }
}

export class MeViewDto extends OmitType(UserViewDto, ['createdAt', 'id'] as const) {
  userId: string;

  static mapToView(user: UserDbType): MeViewDto {
    const dto = new this();

    dto.email = user.email;
    dto.login = user.login;
    dto.userId = user.id.toString();

    return dto;
  }
}
