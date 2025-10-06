import { IsStringWithTrimDecorator } from '../../../../../core/decorators/validation/is-string-with-trim.decorator';
import { contentConstraints } from '../../domain/entities/comment.entity';

export class CommentInputDto {
  @IsStringWithTrimDecorator(contentConstraints.minLength, contentConstraints.maxLength)
  content: string;
}
