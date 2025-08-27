import { IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
//TODO: УДАЛИТЬ!!!
export class IdInputDto {
  @Type(() => Number)
  @IsNumber()
  id: number;
}
