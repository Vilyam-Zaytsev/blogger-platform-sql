import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../../../core/entities/base-entity';
import { User } from '../../../../user-accounts/users/domain/entities/user.entity';
import { Game } from './game.entity';

export enum GameRole {
  Host = 'Host',
  Player = 'Player',
}

@Entity()
export class Player extends BaseEntity {
  @Column({
    type: 'enum',
    enum: GameRole,
    default: GameRole.Player,
  })
  public role: GameRole;

  @ManyToOne(() => Game, (game: Game) => game.players, { onDelete: 'CASCADE' })
  @JoinColumn()
  public game: Game;

  @Column()
  public gameId: number;

  @ManyToOne(() => User, (user: User) => user.players, { onDelete: 'CASCADE' })
  @JoinColumn()
  public user: User;

  @Column()
  public userId: number;
}
