import { IsStringWithTrimDecorator } from '../../../../../core/decorators/validation/is-string-with-trim.decorator';
import {
  contentConstraints,
  shortDirectionConstraints,
  titleConstraints,
} from '../../domain/entities/post.entity';

export class PostInputDto {
  @IsStringWithTrimDecorator(titleConstraints.minLength, titleConstraints.maxLength)
  title: string;

  @IsStringWithTrimDecorator(
    shortDirectionConstraints.minLength,
    shortDirectionConstraints.maxLength,
  )
  shortDescription: string;

  @IsStringWithTrimDecorator(contentConstraints.minLength, contentConstraints.maxLength)
  content: string;
}
