import { IsEnum, IsOptional } from 'class-validator';
import { BaseQueryParams } from '../../../../../core/dto/base.query-params.input-dto';
import { IsStringWithTrimDecorator } from '../../../../../core/decorators/validation/is-string-with-trim.decorator';
import { loginConstraints } from '../../domain/entities/user.entity';

export enum UsersSortBy {
  CreatedAt = 'createdAt',
  UpdatedAt = 'updatedAt',
  DeletedAt = 'deletedAt',
  Login = 'login',
  Email = 'email',
}

export class GetUsersQueryParams extends BaseQueryParams<UsersSortBy> {
  @IsEnum(UsersSortBy)
  sortBy: UsersSortBy = UsersSortBy.CreatedAt;

  @IsStringWithTrimDecorator(1, loginConstraints.maxLength)
  @IsOptional()
  searchLoginTerm: string | null = null;

  @IsStringWithTrimDecorator(1, 255)
  @IsOptional()
  searchEmailTerm: string | null = null;
}
