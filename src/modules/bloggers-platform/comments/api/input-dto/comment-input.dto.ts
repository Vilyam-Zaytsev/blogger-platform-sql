import { IsStringWithTrimDecorator } from '../../../../../core/decorators/validation/is-string-with-trim.decorator';

export const contentConstraints = {
  minLength: 20,
  maxLength: 300,
};

export class CommentInputDto {
  @IsStringWithTrimDecorator(contentConstraints.minLength, contentConstraints.maxLength)
  content: string;
}
