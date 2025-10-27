import { BaseEntity } from '../../../../../core/entities/base-entity';
import { Column, Entity, ManyToOne, OneToOne } from 'typeorm';
import { User } from '../../../../user-accounts/users/domain/entities/user.entity';
import { ReactionPost } from './reaction-post.entity';
import { ReactionCreateDto } from '../../dto/reaction.create-dto';
import { ReactionComment } from './reaction-comment.entity';

export enum ReactionStatus {
  None = 'None',
  Like = 'Like',
  Dislike = 'Dislike',
}

@Entity()
export class Reaction extends BaseEntity {
  @Column({
    type: 'enum',
    enum: ReactionStatus,
    default: ReactionStatus.None,
  })
  public status: ReactionStatus;

  @ManyToOne(() => User, (user: User) => user.reactions, {
    onDelete: 'CASCADE',
  })
  public user: User;

  @Column()
  public userId: number;

  @OneToOne(() => ReactionPost, (reactionPost: ReactionPost) => reactionPost.reaction, {
    cascade: true,
    eager: true,
  })
  public reactionPost: ReactionPost;

  @OneToOne(() => ReactionComment, (reactionComment: ReactionComment) => reactionComment.reaction, {
    cascade: true,
    eager: true,
  })
  public reactionComment: ReactionComment;

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

  static createForComment({ status, userId, parentId: postId }: ReactionCreateDto): Reaction {
    const reaction = new this();
    reaction.status = status;
    reaction.userId = userId;
    reaction.reactionComment = ReactionComment.create(postId);

    return reaction;
  }

  public updateStatus(status: ReactionStatus) {
    this.status = status;
  }
}
