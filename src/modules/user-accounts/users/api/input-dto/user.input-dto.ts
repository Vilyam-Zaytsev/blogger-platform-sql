import { IsStringWithTrimDecorator } from '../../../../../core/decorators/validation/is-string-with-trim.decorator';
import { IsEmail, IsString, Matches } from 'class-validator';
import { TrimDecorator } from '../../../../../core/decorators/transform/trim.decorator';

export class UserInputDto {
  @Matches(/^[a-zA-Z0-9_-]*$/)
  @IsStringWithTrimDecorator(3, 10)
  login: string;

  @IsString()
  @IsEmail()
  @Matches(/^[\w.-]+@([\w-]+\.)+[\w-]{2,4}$/)
  @TrimDecorator()
  email: string;

  @IsStringWithTrimDecorator(6, 20)
  password: string;
}
