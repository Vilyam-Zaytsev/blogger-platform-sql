import { Check, Column, Entity, OneToMany } from 'typeorm';
import { QuestionInputDto } from '../../api/input-dto/question.input-dto';
import { QuestionUpdateDto } from '../../application/dto/question.update-dto';
import { GameQuestion } from '../../../public/domain/entities/game-question.entity';
import { BaseEntity } from '../../../../../core/entities/base-entity';

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
    type: 'uuid',
    unique: true,
    default: () => 'gen_random_uuid()',
  })
  public publicId: string;

  @Column({
    type: 'varchar',
    length: bodyConstraints.maxLength,
    collation: 'C',
  })
  public body: string;

  @Column('varchar', { array: true })
  public correctAnswers: string[];

  @Column({
    type: 'enum',
    enum: QuestionStatus,
    default: QuestionStatus.NotPublished,
  })
  public status: QuestionStatus;

  @OneToMany(() => GameQuestion, (gameQuestion: GameQuestion) => gameQuestion.question)
  public gameQuestions: GameQuestion[];

  protected constructor() {
    super();
  }

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
