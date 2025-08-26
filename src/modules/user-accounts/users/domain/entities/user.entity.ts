import { Check, Column, Entity, OneToOne } from 'typeorm';
import { BaseEntity } from '../../../../../core/entities/base.entity';
import {
  ConfirmationStatus,
  EmailConfirmationCode,
} from '../../../auth/domain/entities/email-confirmation-code.entity';
import { UserCreateDomainDto } from '../dto/user.create-domain-dto';
import { PasswordRecoveryCode } from '../../../auth/domain/entities/password-recovery-code.entity';

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
  })
  public login: string;

  @Column({
    type: 'varchar',
    length: 255,
    unique: true,
  })
  public email: string;

  @Column({ length: 255 })
  public passwordHash: string;

  //TODO: есть ли необходимость в добавить protected (protected потому что private не получится из за наследования) конструктор для того чтобы закрыть создание экземпляров из вне?

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
    user.emailConfirmationCode = EmailConfirmationCode.create({
      confirmationCode,
      expirationDate,
    });

    return user;
  }

  public confirmEmail() {
    this.emailConfirmationCode.confirmationCode = null;
    this.emailConfirmationCode.expirationDate = null;
    this.emailConfirmationCode.confirmationStatus = ConfirmationStatus.Confirmed;
  }

  @OneToOne(() => EmailConfirmationCode, (emailConfirmationCode) => emailConfirmationCode.user)
  emailConfirmationCode: EmailConfirmationCode;

  @OneToOne(() => PasswordRecoveryCode, (passwordRecoveryCode) => passwordRecoveryCode.user)
  passwordRecoveryCode: PasswordRecoveryCode;
}
