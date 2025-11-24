import { BaseQueryParams } from '../../../../../core/dto/base.query-params.input-dto';
import { IsEnum } from 'class-validator';

export enum GamesSortBy {
  CreatedAt = 'createdAt',
  UpdatedAt = 'updatedAt',
  DeletedAt = 'deletedAt',
  StartGameDate = 'startGameDate',
  FinishGameDate = 'finishGameDate',
  Status = 'status',
}

export class GetGamesQueryParams extends BaseQueryParams<GamesSortBy> {
  @IsEnum(GamesSortBy)
  sortBy: GamesSortBy = GamesSortBy.CreatedAt;
}
