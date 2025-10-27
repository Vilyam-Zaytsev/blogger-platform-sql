import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../../../core/entities/base-entity';
import { User } from '../../../../user-accounts/users/domain/entities/user.entity';
import { Game } from './game.entity';

export enum GameRole {
  Host = 'Host',
  Player = 'Player',
}

@Entity({ name: 'players' })
export class Player extends BaseEntity {
  @Column({
    type: 'enum',
    enum: GameRole,
    default: GameRole.Player,
  })
  public role: GameRole;

  @ManyToOne(() => Game, (game: Game) => game.players, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'gameId' })
  public game: Game;
  @Column()
  public gameId: number;

  @ManyToOne(() => User, (user: User) => user.players, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  public user: User;
  @Column()
  public userId: number;
}
