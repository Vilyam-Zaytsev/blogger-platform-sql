import { IsArray, IsNumber, IsOptional, IsString, Matches } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export enum TopPlayersSortField {
  SumScore = 'sumScore',
  AvgScores = 'avgScores',
  GamesCount = 'gamesCount',
  WinsCount = 'winsCount',
  LossesCount = 'lossesCount',
  DrawsCount = 'drawsCount',
}

const sortFieldsPattern: string = Object.values(TopPlayersSortField).join('|');

const sortRegex = new RegExp(`^(${sortFieldsPattern})\\s(asc|desc)$`);

export class GetTopPlayersQueryParams {
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return ['avgScores desc', 'sumScore desc'];
    return Array.isArray(value) ? value : [value];
  })
  @IsArray()
  @IsString({ each: true })
  @Matches(sortRegex, {
    each: true,
    message: `Each sort parameter must be in format: "fieldName asc" or "fieldName desc". Valid fields: ${Object.values(TopPlayersSortField).join(', ')}. Case-sensitive!`,
  })
  sort: string[] = ['avgScores desc', 'sumScore desc'];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  pageNumber: number = 1;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  pageSize: number = 10;

  public getParsedSort(): Array<{ field: string; direction: 'ASC' | 'DESC' }> {
    return this.sort.map((sortParam) => {
      const [field, direction] = sortParam.split(' ');

      return {
        field,
        direction: direction.toUpperCase() as 'ASC' | 'DESC',
      };
    });
  }

  public calculateSkip(): number {
    return (this.pageNumber - 1) * this.pageSize;
  }
}
