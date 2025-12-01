import { PlayerViewDto } from './player.view-dto';
import { RawTopPlayer } from '../../infrastructure/query/types/raw-top-players.type';

export class TopGamePlayerViewDto {
  sumScore: number = 0;
  avgScores: number = 0;
  gamesCount: number = 0;
  winsCount: number = 0;
  lossesCount: number = 0;
  drawsCount: number = 0;
  player: PlayerViewDto;

  static mapToView(topPlayer: RawTopPlayer): TopGamePlayerViewDto {
    const dto = new this();

    dto.sumScore = +topPlayer.sumScore;
    dto.avgScores = +topPlayer.avgScores;
    dto.gamesCount = +topPlayer.gamesCount;
    dto.winsCount = +topPlayer.winsCount;
    dto.lossesCount = +topPlayer.lossesCount;
    dto.drawsCount = +topPlayer.drawsCount;
    dto.player = {
      id: topPlayer.userId.toString(),
      login: topPlayer.userLogin,
    };

    return dto;
  }
}
