import { BaseEntity } from '../../../../../core/entities/base.entity';
import { Column, Entity, ManyToOne, OneToOne } from 'typeorm';
import { User } from '../../../../user-accounts/users/domain/entities/user.entity';
import { ReactionPost } from './reaction-post.entity';
import { ReactionCreateDto } from '../../dto/reaction.create-dto';

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

  @ManyToOne(() => User, (user) => user.reactions, {
    onDelete: 'CASCADE',
  })
  user: User;

  @Column()
  userId: number;

  @OneToOne(() => ReactionPost, (reactionPost) => reactionPost.reaction, {
    cascade: true,
    eager: true,
  })
  reactionPost: ReactionPost;

  protected constructor() {
    super();
  }

  static createForPost({ status, userId, parentId: postId }: ReactionCreateDto): Reaction {
    const reaction = new this();
    reaction.status = status;
    reaction.userId = userId;
    reaction.reactionPost = ReactionPost.create(postId);

    return reaction;
  }

  public updateStatus(status: ReactionStatus) {
    this.status = status;
  }
}
