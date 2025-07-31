import { SessionDbType } from '../../../auth/types/session-db.type';

export class SessionViewDto {
  ip: string;
  title: string;
  lastActiveDate: string;
  deviceId: string;

  static mapToView(session: SessionDbType): SessionViewDto {
    const dto = new this();

    dto.ip = session.ip;
    dto.title = session.deviceName;
    dto.lastActiveDate = session.iat;
    dto.deviceId = session.deviceId;

    return dto;
  }
}
