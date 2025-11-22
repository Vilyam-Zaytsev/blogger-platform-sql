import { IsString } from 'class-validator';

export class AnswerInputDto {
  @IsString()
  answer: string;
}
