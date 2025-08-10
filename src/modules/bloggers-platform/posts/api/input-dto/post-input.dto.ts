import { IsStringWithTrimDecorator } from '../../../../../core/decorators/validation/is-string-with-trim.decorator';

export class PostInputDto {
  @IsStringWithTrimDecorator(1, 30)
  title: string;

  @IsStringWithTrimDecorator(1, 100)
  shortDescription: string;

  @IsStringWithTrimDecorator(1, 1000)
  content: string;
}
