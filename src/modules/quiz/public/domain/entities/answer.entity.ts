import {
  Column,
  CreateDateColumn,
  Entity,
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

@Entity({ name: 'answers' })
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
  public player: Player;

  @Column()
  public playerId: number;

  @ManyToOne(() => GameQuestion, { onDelete: 'CASCADE' })
  public gameQuestion: GameQuestion;

  @Column()
  public gameQuestionId: number;

  @ManyToOne(() => Game, { onDelete: 'CASCADE' })
  public game: Game;

  public gameId: number;
}
