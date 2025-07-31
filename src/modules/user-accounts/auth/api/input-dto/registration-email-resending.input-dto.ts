import { IsEmail, IsString, Matches } from 'class-validator';
import { TrimDecorator } from '../../../../../core/decorators/transform/trim.decorator';

export class RegistrationEmailResandingInputDto {
  @IsString()
  @IsEmail()
  @Matches(/^[\w.-]+@([\w-]+\.)+[\w-]{2,4}$/)
  @TrimDecorator()
  email: string;
}
