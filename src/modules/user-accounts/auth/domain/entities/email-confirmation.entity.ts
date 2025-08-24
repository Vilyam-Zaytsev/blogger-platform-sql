import { Column, Entity, JoinColumn, OneToOne, RelationId } from 'typeorm';
import { BaseEntity } from '../../../../../core/entities/base.entity';
import { User } from '../../../users/domain/entities/user.entity';

export enum ConfirmationStatus {
  Confirmed = 'Confirmed',
  NotConfirmed = 'Not confirmed',
}

@Entity({ name: 'email_confirmation_codes' })
export class EmailConfirmationCode extends BaseEntity {
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

  @OneToOne(() => User, (user) => user.emailConfirmationCode, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @RelationId((emailConfirmationCode: EmailConfirmationCode) => emailConfirmationCode.user)
  public userId: number;
}
