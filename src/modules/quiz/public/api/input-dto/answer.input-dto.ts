import { IsStringWithTrimDecorator } from '../../../../../core/decorators/validation/is-string-with-trim.decorator';

export class AnswerInputDto {
  @IsStringWithTrimDecorator(1, 255)
  answer: string;
}
