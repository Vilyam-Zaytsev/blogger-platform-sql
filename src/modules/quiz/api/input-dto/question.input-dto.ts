import { IsStringWithTrimDecorator } from '../../../../core/decorators/validation/is-string-with-trim.decorator';
import { bodyConstraints } from '../../domain/entities/question.entity';
import { IsStringArrayWithLength } from '../../../../core/decorators/validation/is-string-array-with-length';

export class QuestionInputDto {
  @IsStringWithTrimDecorator(bodyConstraints.minLength, bodyConstraints.maxLength)
  body: string;

  @IsStringArrayWithLength(1, 500, {
    message: 'Each correctAnswer must be a string between 1 and 500 characters',
  })
  correctAnswers: string[];
}
