import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Game } from './game.entity';
import { Question } from '../../../admin/domain/entities/question.entity';

@Entity({ name: 'game_questions' })
@Unique(['game', 'question'])
@Unique(['game', 'order'])
export class GameQuestion {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column('int')
  order: number;

  @CreateDateColumn()
  addedAt: Date;

  @ManyToOne(() => Game, (game: Game) => game.gameQuestions, { onDelete: 'CASCADE' })
  @JoinColumn()
  public game: Game;

  @ManyToOne(() => Question, (question: Question) => question.gameQuestions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  public question: Question;
}
