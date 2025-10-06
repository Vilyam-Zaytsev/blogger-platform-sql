import { Check, Column, Entity, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../../../core/entities/base.entity';
import { User } from '../../../../user-accounts/users/domain/entities/user.entity';

export const contentConstraints = {
  minLength: 20,
  maxLength: 300,
};

@Entity({ name: 'comments' })
@Check(
  'CHK_content_length',
  `char_length(content) >= ${contentConstraints.minLength} AND char_length(content) <= ${contentConstraints.maxLength}`,
)
export class Comment extends BaseEntity {
  @Column({
    type: 'varchar',
    length: contentConstraints.maxLength,
    collation: 'C',
  })
  public content: string;

  protected constructor() {
    super();
  }

  @ManyToOne(() => User, (user: User) => user.comments, {
    onDelete: 'CASCADE',
  })
  user: User;

  @Column()
  userId: number;
}
