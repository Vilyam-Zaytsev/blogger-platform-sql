import { IsString } from 'class-validator';

export class IdInputDto {
  @IsString()
  id: string;
}
