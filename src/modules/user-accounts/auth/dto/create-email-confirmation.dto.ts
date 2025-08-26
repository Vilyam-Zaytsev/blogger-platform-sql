import { ConfirmationStatus } from '../domain/entities/email-confirmation-code.entity';

export class CreateEmailConfirmationDto {
  userId: number;
  confirmationCode: string | null;
  expirationDate: Date | null;
  confirmationStatus: ConfirmationStatus;
}

export class UpdateEmailConfirmationDto extends CreateEmailConfirmationDto {}
