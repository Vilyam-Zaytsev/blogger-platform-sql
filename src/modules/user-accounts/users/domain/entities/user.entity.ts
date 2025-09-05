import { Check, Column, Entity, OneToMany, OneToOne } from 'typeorm';
import { BaseEntity } from '../../../../../core/entities/base.entity';
import {
  ConfirmationStatus,
  EmailConfirmationCode,
} from '../../../auth/domain/entities/email-confirmation-code.entity';
import { UserCreateDomainDto } from '../dto/user.create-domain-dto';
import { PasswordRecoveryCode } from '../../../auth/domain/entities/password-recovery-code.entity';
import { Session } from '../../../sessions/domain/entities/session.entity';

export const loginConstraints = {
  minLength: 3,
  maxLength: 10,
  match: /^[a-zA-Z0-9_-]*$/,
};

export const emailConstraints = {
  match: /^[\w.-]+@([\w-]+\.)+[\w-]{2,4}$/,
};

export const passwordConstraints = {
  minLength: 6,
  maxLength: 20,
};

@Entity({ name: 'users' })
@Check(
  'CHK_login_length',
  `char_length(login) >= ${loginConstraints.minLength} AND char_length(login) <= ${loginConstraints.maxLength}`,
)
@Check('CHK_login_pattern', `login ~ '${loginConstraints.match.source}'`)
@Check('CHK_email_pattern', `email ~ '${emailConstraints.match.source}'`)
export class User extends BaseEntity {
  @Column({
    type: 'varchar',
    length: loginConstraints.maxLength,
    unique: true,
    collation: 'C',
  })
  public login: string;

  @Column({
    type: 'varchar',
    length: 255,
    unique: true,
    collation: 'C',
  })
  public email: string;

  @Column({ length: 255 })
  public passwordHash: string;

  protected constructor() {
    super();
  }

  static create({
    email,
    login,
    passwordHash,
    confirmationCode,
    expirationDate,
  }: UserCreateDomainDto): User {
    const user = new this();

    user.email = email;
    user.login = login;
    user.passwordHash = passwordHash;
    user.emailConfirmationCode = EmailConfirmationCode.create(confirmationCode, expirationDate);

    return user;
  }

  public confirmEmail() {
    this.emailConfirmationCode.confirmationCode = null;
    this.emailConfirmationCode.expirationDate = null;
    this.emailConfirmationCode.confirmationStatus = ConfirmationStatus.Confirmed;
  }

  public updateEmailConfirmationCode(confirmationCode: string, expirationDate: Date) {
    this.emailConfirmationCode.confirmationCode = confirmationCode;
    this.emailConfirmationCode.expirationDate = expirationDate;
  }

  public updatePasswordRecoveryCode(recoveryCode: string, expirationDate: Date) {
    if (!this.passwordRecoveryCode) {
      this.passwordRecoveryCode = PasswordRecoveryCode.create(recoveryCode, expirationDate);

      return;
    }

    this.passwordRecoveryCode.recoveryCode = recoveryCode;
    this.passwordRecoveryCode.expirationDate = expirationDate;
  }

  public updatePasswordHash(newPasswordHash: string) {
    this.passwordHash = newPasswordHash;

    this.passwordRecoveryCode.recoveryCode = null;
    this.passwordRecoveryCode.expirationDate = null;
  }

  @OneToOne(() => EmailConfirmationCode, (emailConfirmationCode) => emailConfirmationCode.user, {
    cascade: true,
  })
  emailConfirmationCode: EmailConfirmationCode;

  @OneToOne(() => PasswordRecoveryCode, (passwordRecoveryCode) => passwordRecoveryCode.user, {
    cascade: true,
  })
  passwordRecoveryCode: PasswordRecoveryCode;

  @OneToMany(() => Session, (session) => session.user)
  sessions: Session[];
}
