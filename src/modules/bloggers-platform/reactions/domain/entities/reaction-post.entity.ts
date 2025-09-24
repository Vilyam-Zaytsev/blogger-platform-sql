import { Column, Entity, JoinColumn, ManyToOne, OneToOne, PrimaryColumn } from 'typeorm';
import { Reaction } from './reaction.entity';
import { Post } from '../../../posts/domain/entities/post.entity';

@Entity({ name: 'reactions_posts' })
export class ReactionPost {
  @PrimaryColumn({ type: 'int' })
  reactionId: number;

  @OneToOne(() => Reaction, (reaction) => reaction.postLink, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'reactionId' })
  reaction: Reaction;

  @ManyToOne(() => Post, (post) => post.reactions)
  @JoinColumn({ name: 'postId' })
  post: Post;

  @Column({ type: 'int' })
  postId: number;
}
