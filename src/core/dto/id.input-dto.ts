import { IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class IdInputDto {
  @Type(() => Number)
  @IsNumber()
  id: number;
}
