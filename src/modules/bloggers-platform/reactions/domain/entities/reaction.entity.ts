import { BaseEntity } from '../../../../../core/entities/base.entity';
import { Column, Entity, ManyToOne, OneToOne } from 'typeorm';
import { User } from '../../../../user-accounts/users/domain/entities/user.entity';
import { ReactionPost } from './reaction-post.entity';

export enum ReactionStatus {
  None = 'None',
  Like = 'Like',
  Dislike = 'Dislike',
}

@Entity({ name: 'reactions' })
export class Reaction extends BaseEntity {
  @Column({
    type: 'enum',
    enum: ReactionStatus,
    default: ReactionStatus.None,
  })
  public status: ReactionStatus;

  protected constructor() {
    super();
  }

  static createForPost(userId: number, postId: number, status: ReactionStatus): Reaction {
    const reaction = new this();
    reaction.userId = userId;
    reaction.status = status;

    reaction.postLink = new ReactionPost();
    reaction.postLink.postId = postId;

    return reaction;
  }

  @ManyToOne(() => User, (user) => user.reactions, {
    onDelete: 'CASCADE',
  })
  user: User;

  @Column()
  userId: number;

  @OneToOne(() => ReactionPost, (postLink) => postLink.reaction, { cascade: true, eager: true })
  postLink?: ReactionPost;
}
