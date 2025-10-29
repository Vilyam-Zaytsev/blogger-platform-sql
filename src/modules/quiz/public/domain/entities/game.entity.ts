import { Column, Entity, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../../../core/entities/base-entity';
import { Player } from './player.entity';
import { GameQuestion } from './game-question.entity';

export enum GameStatus {
  Pending = 'PendingSecondPlayer',
  Active = 'Active',
  Finished = 'Finished',
}

@Entity({ name: 'games' })
export class Game extends BaseEntity {
  @Column({
    type: 'enum',
    enum: GameStatus,
    default: GameStatus.Pending,
  })
  public status: GameStatus;

  @OneToMany(() => Player, (player: Player) => player.game)
  public players: Player[];

  @OneToMany(() => GameQuestion, (gameQuestion: GameQuestion) => gameQuestion.game)
  public gameQuestions: GameQuestion[];
}
