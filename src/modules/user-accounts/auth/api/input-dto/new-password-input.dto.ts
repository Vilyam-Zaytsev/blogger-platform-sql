import { IsStringWithTrimDecorator } from '../../../../../core/decorators/validation/is-string-with-trim.decorator';

export class NewPasswordInputDto {
  @IsStringWithTrimDecorator(6, 20)
  newPassword: string;
  @IsStringWithTrimDecorator(1, 1000)
  recoveryCode: string;
}
