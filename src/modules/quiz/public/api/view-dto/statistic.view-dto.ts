import { RawStatistic } from '../../infrastructure/query/types/raw-statistic.type';

export class StatisticViewDto {
  sumScore: number;
  avgScores: number;
  gamesCount: number;
  winsCount: number;
  lossesCount: number;
  drawsCount: number;

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
