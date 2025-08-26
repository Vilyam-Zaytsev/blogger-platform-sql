import { ConfirmationStatus } from '../domain/entities/email-confirmation-code.entity';

export type EmailConfirmationDbType = {
  userId: number;
  confirmationCode: string | null;
  expirationDate: string | null;
  confirmationStatus: ConfirmationStatus;
  deletedAt: string | null;
};
