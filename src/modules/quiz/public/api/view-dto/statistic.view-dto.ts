import { RawStatistic } from '../../infrastructure/query/types/raw-statistic.type';

export class StatisticViewDto {
  sumScore: number = 0;
  avgScores: number = 0;
  gamesCount: number = 0;
  winsCount: number = 0;
  lossesCount: number = 0;
  drawsCount: number = 0;

  static mapToView(statistic: RawStatistic): StatisticViewDto {
    const dto = new this();

    dto.sumScore = +statistic.sumScore;
    dto.avgScores = +statistic.avgScores;
    dto.gamesCount = +statistic.gamesCount;
    dto.winsCount = +statistic.winsCount;
    dto.lossesCount = +statistic.lossesCount;
    dto.drawsCount = +statistic.drawsCount;

    return dto;
  }
}
