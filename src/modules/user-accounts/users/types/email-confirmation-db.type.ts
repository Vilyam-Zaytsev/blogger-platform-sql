export enum ConfirmationStatus {
  Confirmed = 'Confirmed',
  NotConfirmed = 'Not confirmed',
}

export type EmailConfirmationDbType = {
  userId: number;
  confirmationCode: string | null;
  expirationDate: string | null;
  confirmationStatus: ConfirmationStatus;
  deletedAt: string | null;
};
