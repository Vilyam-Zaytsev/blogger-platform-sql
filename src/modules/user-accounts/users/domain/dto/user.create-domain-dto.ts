export class UserCreateDomainDto {
  login: string;
  email: string;
  passwordHash: string;
  confirmationCode: string;
  expirationDate: Date;
}
