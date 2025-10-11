import { Check, Column, Entity } from 'typeorm';
import { BaseEntity } from '../../../../core/entities/base.entity';

export enum QuestionStatus {
  Draft = 'Draft',
  Published = 'Published',
}

export const bodyConstraints = {
  minLength: 10,
  maxLength: 500,
};

@Entity({ name: 'question' })
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
    default: QuestionStatus.Draft,
  })
  status: QuestionStatus;
}
