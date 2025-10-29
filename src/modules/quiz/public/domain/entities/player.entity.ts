import { Column, Entity, JoinColumn, ManyToOne, OneToMany, Unique } from 'typeorm';
import { BaseEntity } from '../../../../../core/entities/base-entity';
import { User } from '../../../../user-accounts/users/domain/entities/user.entity';
import { Game } from './game.entity';
import { Answer } from './answer.entity';

export enum GameRole {
  Host = 'Host',
  Player = 'Player',
}

@Entity({ name: 'players' })
@Unique(['user', 'game'])
export class Player extends BaseEntity {
  @Column({
    type: 'enum',
    enum: GameRole,
    default: GameRole.Player,
  })
  public role: GameRole;

  @Column({
    type: 'int',
    default: 0,
  })
  score: number;

  @ManyToOne(() => Game, (game: Game) => game.players, { onDelete: 'CASCADE' })
  @JoinColumn()
  public game: Game;

  @ManyToOne(() => User, (user: User) => user.players, { onDelete: 'CASCADE' })
  @JoinColumn()
  public user: User;

  @OneToMany(() => Answer, (answer: Answer) => answer.player)
  public answers: Answer[];
}
