import { IsStringWithTrimDecorator } from '../../../../../core/decorators/validation/is-string-with-trim.decorator';
import { ApiProperty } from '@nestjs/swagger';

export class RegistrationConfirmationCodeInputDto {
  @ApiProperty({
    description: 'Код подтверждения из письма',
    example: '550e8400-e29b-41d4-a716-446655440000',
    type: String,
  })
  @IsStringWithTrimDecorator(1, 1000)
  code: string;
}
