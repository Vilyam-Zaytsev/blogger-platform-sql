import { Session } from '../../domain/entities/session.entity';

export class SessionViewDto {
  ip: string;
  title: string;
  lastActiveDate: string;
  deviceId: string;

  static mapToView(session: Session): SessionViewDto {
    const dto = new this();

    dto.ip = session.ip;
    dto.title = session.deviceName;
    dto.lastActiveDate = session.iat.toISOString();
    dto.deviceId = session.deviceId;

    return dto;
  }
}
