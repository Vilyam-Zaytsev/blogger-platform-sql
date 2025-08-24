import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../../../../core/entities/base.entity';

export enum ConfirmationStatus {
  Confirmed = 'Confirmed',
  NotConfirmed = 'Not confirmed',
}

@Entity()
export class EmailConfirmation extends BaseEntity {
  @Column({
    type: 'varchar',
    length: 255,
    unique: true,
    nullable: true,
  })
  public confirmationCode: string | null;

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  public expirationDate: string | null;

  @Column({
    type: 'enum',
    enum: ConfirmationStatus,
    default: ConfirmationStatus.NotConfirmed,
  })
  public confirmationStatus: ConfirmationStatus;
}
