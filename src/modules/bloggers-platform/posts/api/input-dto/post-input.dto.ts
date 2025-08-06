import { IsStringWithTrimDecorator } from '../../../../../core/decorators/validation/is-string-with-trim.decorator';
import { TrimDecorator } from '../../../../../core/decorators/transform/trim.decorator';
import { IsString } from 'class-validator';

export class PostInputDto {
  @IsStringWithTrimDecorator(1, 30)
  title: string;

  @IsStringWithTrimDecorator(1, 100)
  shortDescription: string;

  @IsStringWithTrimDecorator(1, 1000)
  content: string;

  @IsString()
  @TrimDecorator()
  blogId: string;
}
