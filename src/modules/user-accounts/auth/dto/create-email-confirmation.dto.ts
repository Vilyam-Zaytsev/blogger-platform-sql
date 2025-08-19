import { ConfirmationStatus } from '../types/email-confirmation-db.type';

export class CreateEmailConfirmationDto {
  userId: number;
  confirmationCode: string | null;
  expirationDate: Date | null;
  confirmationStatus: ConfirmationStatus;
}

export class UpdateEmailConfirmationDto extends CreateEmailConfirmationDto {}
