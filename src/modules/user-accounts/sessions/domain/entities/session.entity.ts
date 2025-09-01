import { Column, Entity, ManyToOne, RelationId } from 'typeorm';
import { BaseEntity } from '../../../../../core/entities/base.entity';
import { User } from '../../../users/domain/entities/user.entity';
import { SessionCreateDomainDto } from '../dto/session.create-domain.dto';

@Entity('sessions')
export class Session extends BaseEntity {
  @Column({
    type: 'varchar',
    length: 255,
    unique: true,
  })
  public deviceId: string;

  @Column({
    type: 'varchar',
    length: 255,
  })
  public deviceName: string;

  @Column({
    type: 'varchar',
    length: 255,
  })
  public ip: string;

  @Column({ type: 'timestamptz' })
  public iat: Date;

  @Column({ type: 'timestamptz' })
  public exp: Date;

  static create(dto: SessionCreateDomainDto): Session {
    const session = new this();

    session.deviceId = dto.deviceId;
    session.deviceName = dto.deviceName;
    session.ip = dto.ip;
    session.iat = dto.iat;
    session.exp = dto.exp;

    return session;
  }

  public updateTimestamps(iat: Date, exp: Date) {
    this.iat = iat;
    this.exp = exp;
  }

  @ManyToOne(() => User, (user) => user.sessions, {
    onDelete: 'CASCADE',
  })
  user: User;

  @RelationId((session: Session) => session.user)
  public userId: number;
}
