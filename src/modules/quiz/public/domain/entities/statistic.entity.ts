import { Column, Entity, OneToOne } from 'typeorm';
import { BaseEntity } from '../../../../../core/entities/base-entity';
import { User } from '../../../../user-accounts/users/domain/entities/user.entity';

@Entity({ name: 'statistics' })
export class Statistic extends BaseEntity {
  @Column({
    type: 'int',
    default: 0,
  })
  public sumScore: number;

  @Column({
    type: 'int',
    default: 0,
  })
  public avgScores: number;

  @Column({
    type: 'int',
    default: 0,
  })
  public gamesCount: number;

  @Column({
    type: 'int',
    default: 0,
  })
  public winsCount: number;

  @Column({
    type: 'int',
    default: 0,
  })
  public lossesCount: number;

  @Column({
    type: 'int',
    default: 0,
  })
  public drawsCount: number;

  @OneToOne(() => User, (user: User) => user.statistic)
  public user: User;

  @Column()
  public userId: number;

  protected constructor() {
    super();
  }

  static create(): Statistic {
    return new this();
  }
}
