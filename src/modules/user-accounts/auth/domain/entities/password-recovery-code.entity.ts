import { Column, Entity, JoinColumn, OneToOne, RelationId } from 'typeorm';
import { BaseEntity } from '../../../../../core/entities/base.entity';
import { User } from '../../../users/domain/entities/user.entity';

@Entity({ name: 'password_recovery_codes' })
export class PasswordRecoveryCode extends BaseEntity {
  @Column({
    type: 'varchar',
    length: 255,
    unique: true,
    nullable: true,
  })
  public recoveryCode: string | null;

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  public expirationDate: Date | null;

  protected constructor() {
    super();
  }

  static create(recoveryCode: string, expirationDate: Date): PasswordRecoveryCode {
    const passwordRecoveryCode = new this();

    passwordRecoveryCode.recoveryCode = recoveryCode;
    passwordRecoveryCode.expirationDate = expirationDate;

    return passwordRecoveryCode;
  }

  @OneToOne(() => User, (user) => user.passwordRecoveryCode, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @RelationId((passwordRecoveryCode: PasswordRecoveryCode) => passwordRecoveryCode.user)
  public userId: number;
}
