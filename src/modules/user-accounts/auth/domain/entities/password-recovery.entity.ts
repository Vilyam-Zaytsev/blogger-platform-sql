import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../../../../core/entities/base.entity';

@Entity()
export class PasswordRecovery extends BaseEntity {
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
}
