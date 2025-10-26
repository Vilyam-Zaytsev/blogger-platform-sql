import { Check, Column, Entity, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../../../core/entities/base.entity';
import { QuestionInputDto } from '../../api/input-dto/question.input-dto';
import { QuestionUpdateDto } from '../../application/dto/question.update-dto';
import { GameQuestion } from '../../../public/domain/entities/game-question.entity';

export enum QuestionStatus {
  NotPublished = 'notPublished',
  Published = 'published',
}

export const bodyConstraints = {
  minLength: 10,
  maxLength: 500,
};

export const correctAnswersConstraints = {
  minLength: 1,
  maxLength: 100,
};

@Entity({ name: 'questions' })
@Check(
  'CHK_correctAnswers_length',
  `check_varchar_array_length("correct_answers", ${correctAnswersConstraints.minLength}, ${correctAnswersConstraints.maxLength})`,
)
@Check(
  'CHK_body_length',
  `char_length(body) >= ${bodyConstraints.minLength} AND char_length(body) <= ${bodyConstraints.maxLength}`,
)
export class Question extends BaseEntity {
  @Column({
    type: 'varchar',
    length: bodyConstraints.maxLength,
    collation: 'C',
  })
  body: string;

  @Column('varchar', { array: true })
  correctAnswers: string[];

  @Column({
    type: 'enum',
    enum: QuestionStatus,
    default: QuestionStatus.NotPublished,
  })
  status: QuestionStatus;

  @OneToMany(() => GameQuestion, (gameQuestion: GameQuestion) => gameQuestion.question)
  gameQuestions: GameQuestion[];

  static create({ body, correctAnswers }: QuestionInputDto): Question {
    const question = new this();

    question.body = body;
    question.correctAnswers = correctAnswers;
    question.status = QuestionStatus.NotPublished;

    return question;
  }

  public update({ body, correctAnswers }: QuestionUpdateDto) {
    this.body = body;
    this.correctAnswers = correctAnswers;
  }

  public publish() {
    this.status = QuestionStatus.Published;
  }

  public removePublication() {
    this.status = QuestionStatus.NotPublished;
  }
}
