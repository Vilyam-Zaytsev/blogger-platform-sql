export enum ConfirmationStatus {
  Confirmed = 'Confirmed',
  NotConfirmed = 'Not confirmed',
}

export type EmailConfirmationDbType = {
  userId: number;
  confirmationCode: string;
  expirationDate: Date;
  confirmationStatus: ConfirmationStatus;
};
