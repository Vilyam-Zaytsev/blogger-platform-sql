import { Column, Entity, Generated, OneToMany } from 'typeorm';
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
    type: 'uuid',
    unique: true,
  })
  @Generated('uuid')
  public publicId: string;

  @Column({
    type: 'enum',
    enum: GameStatus,
    default: GameStatus.Pending,
  })
  public status: GameStatus;

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  public startGameDate: Date | null;

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  public finishGameDate: Date | null;

  @OneToMany(() => Player, (player: Player) => player.game)
  public players: Player[];

  @OneToMany(() => GameQuestion, (gameQuestion: GameQuestion) => gameQuestion.game)
  public gameQuestions: GameQuestion[];

  protected constructor() {
    super();
  }

  static create(): Game {
    const game = new this();

    game.status = GameStatus.Pending;

    return game;
  }

  public startGame() {
    this.status = GameStatus.Active;
    this.startGameDate = new Date();
  }

  public finishGame() {
    this.status = GameStatus.Finished;
    this.startGameDate = new Date();
  }
}
