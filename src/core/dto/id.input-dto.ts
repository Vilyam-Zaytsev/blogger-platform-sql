import { IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

//TODO: Правильно ли я делаю, что преобразую id в число таким образом?
export class IdInputDto {
  @Type(() => Number)
  @IsNumber()
  id: number;
}
