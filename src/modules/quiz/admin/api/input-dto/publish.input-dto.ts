import { IsBoolean } from 'class-validator';

export class PublishInputDto {
  @IsBoolean()
  published: boolean;
}
