export class SessionCreateDomainDto {
  userId: number;
  deviceId: string;
  deviceName: string;
  ip: string;
  iat: Date;
  exp: Date;
}
