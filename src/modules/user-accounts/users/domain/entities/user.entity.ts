import { Check, Column, Entity } from 'typeorm';
import { BaseEntity } from '../../../../../core/entities/base.entity';

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
}
