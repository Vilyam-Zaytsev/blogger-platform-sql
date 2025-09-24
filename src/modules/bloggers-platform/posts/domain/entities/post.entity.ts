import { Check, Column, Entity, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../../../core/entities/base.entity';
import { Blog } from '../../../blogs/domain/entities/blog.entity';
import { CreatePostDto } from '../../application/dto/create-post.dto';

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

  protected constructor() {
    super();
  }

  static create({ title, shortDescription, content, blogId }: CreatePostDto): Post {
    const post = new this();

    post.title = title;
    post.shortDescription = shortDescription;
    post.content = content;
    post.blogId = blogId;

    return post;
  }

  @ManyToOne(() => Blog, (blog: Blog): Post[] => blog.posts, {
    onDelete: 'CASCADE',
  })
  blog: Blog;

  @Column()
  public blogId: number;
}
