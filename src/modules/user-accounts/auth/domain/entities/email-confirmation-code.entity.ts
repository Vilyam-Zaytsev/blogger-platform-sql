import { Column, Entity, JoinColumn, OneToOne, RelationId } from 'typeorm';
import { BaseEntity } from '../../../../../core/entities/base.entity';
import { User } from '../../../users/domain/entities/user.entity';
import { EmailConfirmationCodeCreateDomainDto } from '../dto/email-confirmation-code.create-domain-dto';

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
  public expirationDate: Date | null;

  @Column({
    type: 'enum',
    enum: ConfirmationStatus,
    default: ConfirmationStatus.NotConfirmed,
  })
  public confirmationStatus: ConfirmationStatus;

  //TODO: есть ли необходимость в добавить protected (protected потому что private не получится из за наследования) конструктор для того чтобы закрыть создание экземпляров из вне?

  static create({
    confirmationCode,
    expirationDate,
  }: EmailConfirmationCodeCreateDomainDto): EmailConfirmationCode {
    const emailConfirmationCode = new this();

    emailConfirmationCode.confirmationCode = confirmationCode;
    emailConfirmationCode.expirationDate = expirationDate;
    emailConfirmationCode.confirmationStatus = ConfirmationStatus.NotConfirmed;

    return emailConfirmationCode;
  }

  @OneToOne(() => User, (user) => user.emailConfirmationCode, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: User;

  @RelationId((emailConfirmationCode: EmailConfirmationCode) => emailConfirmationCode.user)
  public userId: number;
}
