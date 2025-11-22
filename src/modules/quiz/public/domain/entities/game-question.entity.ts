import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Game } from './game.entity';
import { Question } from '../../../admin/domain/entities/question.entity';
import { GameQuestionCreateDto } from '../dto/game-question.create-dto';

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
  public game: Game;

  @Column()
  public gameId: number;

  @ManyToOne(() => Question, (question: Question) => question.gameQuestions, {
    onDelete: 'CASCADE',
  })
  public question: Question;

  @Column()
  public questionId: number;

  static create({ order, gameId, questionId }: GameQuestionCreateDto): GameQuestion {
    const gameQuestion = new this();
    gameQuestion.order = order;
    gameQuestion.gameId = gameId;
    gameQuestion.questionId = questionId;

    return gameQuestion;
  }
}
