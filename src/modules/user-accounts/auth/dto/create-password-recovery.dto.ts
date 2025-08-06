export class CreatePasswordRecoveryDto {
  userId: number;
  recoveryCode: string | null;
  expirationDate: Date | null;
}
