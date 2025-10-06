import { Column, Entity, JoinColumn, ManyToOne, OneToOne, PrimaryColumn } from 'typeorm';
import { Reaction } from './reaction.entity';
import { Comment } from '../../../comments/domain/entities/comment.entity';

@Entity({ name: 'reactions_comments' })
export class ReactionComment {
  @PrimaryColumn({ type: 'int' })
  public reactionId: number;

  @OneToOne(() => Reaction, (reaction: Reaction) => reaction.reactionComment, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'reactionId' })
  public reaction: Reaction;

  @ManyToOne(() => Comment, (comment: Comment) => comment.reactions)
  @JoinColumn({ name: 'commentId' })
  public comment: Comment;

  @Column({ type: 'int' })
  public commentId: number;

  static create(commentId: number): ReactionComment {
    const reactionComment = new this();
    reactionComment.commentId = commentId;

    return reactionComment;
  }
}
