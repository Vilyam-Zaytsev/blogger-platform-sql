import { IsStringWithTrimDecorator } from '../../../../../core/decorators/validation/is-string-with-trim.decorator';
import { IsUrl, Matches } from 'class-validator';
import {
  descriptionConstraints,
  nameConstraints,
  websiteUrlConstraints,
} from '../../domain/entities/blog.entity';

export class BlogInputDto {
  @IsStringWithTrimDecorator(nameConstraints.minLength, nameConstraints.maxLength)
  name: string;

  @IsStringWithTrimDecorator(descriptionConstraints.minLength, descriptionConstraints.maxLength)
  description: string;

  @IsStringWithTrimDecorator(1, websiteUrlConstraints.maxLength)
  @IsUrl()
  @Matches(websiteUrlConstraints.match)
  websiteUrl: string;
}
