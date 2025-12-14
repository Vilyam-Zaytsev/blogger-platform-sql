import { IsStringWithTrimDecorator } from '../../../../../core/decorators/validation/is-string-with-trim.decorator';
import { IsEmail, IsString, Matches } from 'class-validator';
import { TrimDecorator } from '../../../../../core/decorators/transform/trim.decorator';
import {
  emailConstraints,
  loginConstraints,
  passwordConstraints,
} from '../../domain/entities/user.entity';
import { ApiProperty } from '@nestjs/swagger';

export class UserInputDto {
  @ApiProperty({
    description: 'Логин пользователя должен быть уникальным',
    minLength: loginConstraints.minLength,
    maxLength: loginConstraints.maxLength,
    pattern: `${loginConstraints.match}`,
    example: 'user',
    type: String,
  })
  @Matches(loginConstraints.match)
  @IsStringWithTrimDecorator(loginConstraints.minLength, loginConstraints.maxLength)
  login: string;

  @ApiProperty({
    description: 'Email пользователя должен быть уникальным',
    pattern: `${emailConstraints.match}`,
    example: 'user@example.com',
    type: String,
  })
  @IsString()
  @IsEmail()
  @Matches(emailConstraints.match)
  @TrimDecorator()
  email: string;

  @ApiProperty({
    description: 'Пароль пользователя (должен содержать буквы или цифры)',
    minLength: passwordConstraints.minLength,
    maxLength: passwordConstraints.maxLength,
    example: 'MySecurePassword123',
    type: String,
  })
  @IsStringWithTrimDecorator(passwordConstraints.minLength, passwordConstraints.maxLength)
  password: string;
}
