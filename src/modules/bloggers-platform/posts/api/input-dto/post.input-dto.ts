import { IsStringWithTrimDecorator } from '../../../../../core/decorators/validation/is-string-with-trim.decorator';
import {
  contentConstraints,
  shortDescriptionConstraints,
  titleConstraints,
} from '../../domain/entities/post.entity';

export class PostInputDto {
  @IsStringWithTrimDecorator(titleConstraints.minLength, titleConstraints.maxLength)
  title: string;

  @IsStringWithTrimDecorator(
    shortDescriptionConstraints.minLength,
    shortDescriptionConstraints.maxLength,
  )
  shortDescription: string;

  @IsStringWithTrimDecorator(contentConstraints.minLength, contentConstraints.maxLength)
  content: string;
}
