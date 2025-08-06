import { IsStringWithTrimDecorator } from '../../../../../core/decorators/validation/is-string-with-trim.decorator';
import { IsUrl, Matches } from 'class-validator';

export class BlogInputDto {
  @IsStringWithTrimDecorator(1, 15)
  name: string;

  @IsStringWithTrimDecorator(1, 500)
  description: string;

  @IsStringWithTrimDecorator(1, 100)
  @IsUrl()
  @Matches(
    /^https:\/\/([a-zA-Z0-9_-]+\.)+[a-zA-Z0-9_-]+(\/[a-zA-Z0-9_-]+)*\/?$/,
  )
  websiteUrl: string;
}
