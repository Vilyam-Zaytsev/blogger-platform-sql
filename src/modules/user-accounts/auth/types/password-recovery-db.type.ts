export type PasswordRecoveryDbType = {
  userId: number;
  recoveryCode: string | null;
  expirationDate: string | null;
};
