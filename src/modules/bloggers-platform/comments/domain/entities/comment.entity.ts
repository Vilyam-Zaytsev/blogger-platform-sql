import { Check, Column, Entity, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntityNumberId } from '../../../../../core/entities/base-entity-number-id';
import { User } from '../../../../user-accounts/users/domain/entities/user.entity';
import { Post } from '../../../posts/domain/entities/post.entity';
import { ReactionComment } from '../../../reactions/domain/entities/reaction-comment.entity';
import { CommentCreateDto } from '../../application/dto/comment.create-dto';

export const contentConstraints = {
  minLength: 20,
  maxLength: 300,
};

@Entity({ name: 'comments' })
@Check(
  'CHK_content_length',
  `char_length(content) >= ${contentConstraints.minLength} AND char_length(content) <= ${contentConstraints.maxLength}`,
)
export class Comment extends BaseEntityNumberId {
  @Column({
    type: 'varchar',
    length: contentConstraints.maxLength,
    collation: 'C',
  })
  public content: string;

  @ManyToOne(() => User, (user: User) => user.comments, {
    onDelete: 'CASCADE',
  })
  public user: User;

  @Column()
  public userId: number;

  @ManyToOne(() => Post, (post: Post) => post.comments, {
    onDelete: 'CASCADE',
  })
  public post: Post;

  @Column()
  public postId: number;

  @OneToMany(() => ReactionComment, (reaction: ReactionComment) => reaction.comment)
  public reactions: ReactionComment[];

  protected constructor() {
    super();
  }

  static create({ userId, postId, content }: CommentCreateDto): Comment {
    const comment = new this();
    comment.content = content;
    comment.userId = userId;
    comment.postId = postId;

    return comment;
  }

  public updateContent(content: string) {
    this.content = content;
  }
}
