import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Player } from './player.entity';
import { GameQuestion } from './game-question.entity';
import { Game } from './game.entity';

export enum AnswerStatus {
  Correct = 'Correct',
  Incorrect = 'Incorrect',
}

@Entity()
@Unique(['player', 'gameQuestion'])
export class Answer {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column({
    type: 'varchar',
    length: 255,
  })
  answerBody: string;

  @Column({
    type: 'enum',
    enum: AnswerStatus,
  })
  status: AnswerStatus;

  @CreateDateColumn()
  addedAt: Date;

  @ManyToOne(() => Player, (player: Player) => player.answers, { onDelete: 'CASCADE' })
  @JoinColumn()
  public player: Player;

  @ManyToOne(() => GameQuestion, { onDelete: 'CASCADE' })
  @JoinColumn()
  public gameQuestion: GameQuestion;

  @ManyToOne(() => Game, { onDelete: 'CASCADE' })
  @JoinColumn()
  public game: Game;
}
