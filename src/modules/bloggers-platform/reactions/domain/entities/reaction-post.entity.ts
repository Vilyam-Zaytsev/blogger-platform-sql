import { Column, Entity, JoinColumn, ManyToOne, OneToOne, PrimaryColumn } from 'typeorm';
import { Reaction } from './reaction.entity';
import { Post } from '../../../posts/domain/entities/post.entity';

@Entity({ name: 'reactions_posts' })
export class ReactionPost {
  @PrimaryColumn({ type: 'int' })
  public reactionId: number;

  @OneToOne(() => Reaction, (reaction: Reaction) => reaction.reactionPost, {
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  public reaction: Reaction;

  @ManyToOne(() => Post, (post: Post) => post.reactions)
  @JoinColumn()
  public post: Post;

  @Column({ type: 'int' })
  public postId: number;

  static create(postId: number): ReactionPost {
    const reactionPost = new this();
    reactionPost.postId = postId;

    return reactionPost;
  }
}
