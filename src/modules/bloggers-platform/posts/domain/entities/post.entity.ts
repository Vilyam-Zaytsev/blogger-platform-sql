import { Check, Column, Entity, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../../../core/entities/base.entity';
import { Blog } from '../../../blogs/domain/entities/blog.entity';
import { PostCreateDto } from '../../application/dto/post.create-dto';
import { ReactionPost } from '../../../reactions/domain/entities/reaction-post.entity';
import { PostUpdateDto } from '../../application/dto/post.update-dto';
import { Comment } from '../../../comments/domain/entities/comment.entity';

export const titleConstraints = {
  minLength: 1,
  maxLength: 30,
};

export const shortDescriptionConstraints = {
  minLength: 1,
  maxLength: 100,
};

export const contentConstraints = {
  minLength: 1,
  maxLength: 1000,
};

@Entity({ name: 'posts' })
@Check(
  'CHK_title_length',
  `char_length(title) >= ${titleConstraints.minLength} AND char_length(title) <= ${titleConstraints.maxLength}`,
)
@Check(
  'CHK_short_direction_length',
  `char_length("shortDescription") >= ${shortDescriptionConstraints.minLength} AND char_length("shortDescription") <= ${shortDescriptionConstraints.maxLength}`,
)
@Check(
  'CHK_content_length',
  `char_length(content) >= ${contentConstraints.minLength} AND char_length(content) <= ${contentConstraints.maxLength}`,
)
export class Post extends BaseEntity {
  @Column({
    type: 'varchar',
    length: titleConstraints.maxLength,
    collation: 'C',
  })
  public title: string;

  @Column({
    type: 'varchar',
    length: shortDescriptionConstraints.maxLength,
    collation: 'C',
  })
  public shortDescription: string;

  @Column({
    type: 'varchar',
    length: contentConstraints.maxLength,
    collation: 'C',
  })
  public content: string;

  @ManyToOne(() => Blog, (blog: Blog): Post[] => blog.posts, {
    onDelete: 'CASCADE',
  })
  public blog: Blog;

  @Column()
  public blogId: number;

  @OneToMany(() => ReactionPost, (reaction: ReactionPost) => reaction.post)
  public reactions: ReactionPost[];

  @OneToMany(() => Comment, (comment: Comment) => comment.post)
  public comments: Comment[];

  protected constructor() {
    super();
  }

  static create({ title, shortDescription, content, blogId }: PostCreateDto): Post {
    const post = new this();

    post.title = title;
    post.shortDescription = shortDescription;
    post.content = content;
    post.blogId = blogId;

    return post;
  }

  public update({ title, shortDescription, content }: PostUpdateDto) {
    this.title = title;
    this.shortDescription = shortDescription;
    this.content = content;
  }
}
