import { IsStringWithTrimDecorator } from '../../../../../core/decorators/validation/is-string-with-trim.decorator';

export class LoginInputDto {
  @IsStringWithTrimDecorator(3, 100)
  loginOrEmail: string;

  @IsStringWithTrimDecorator(6, 20)
  password: string;
}
