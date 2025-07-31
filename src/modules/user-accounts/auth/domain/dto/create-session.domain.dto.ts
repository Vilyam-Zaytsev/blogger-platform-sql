export class CreateSessionDomainDto {
  userId: number;
  deviceId: string;
  deviceName: string;
  ip: string;
  iat: Date;
  exp: Date;
}
