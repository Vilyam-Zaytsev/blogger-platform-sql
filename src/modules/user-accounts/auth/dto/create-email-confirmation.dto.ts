import { ConfirmationStatus } from '../../users/types/email-confirmation-db.type';

export class CreateEmailConfirmationDto {
  userId: number;
  confirmationCode: string;
  expirationDate: Date;
  confirmationStatus: ConfirmationStatus;
}
