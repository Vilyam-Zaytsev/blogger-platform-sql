import { Check, Column, Entity, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../../../core/entities/base.entity';
import { BlogUpdateDto } from '../../dto/blog.update-dto';
import { BlogInputDto } from '../../api/input-dto/blog.input-dto';
import { Post } from '../../../posts/domain/entities/post.entity';

export const nameConstraints = {
  minLength: 1,
  maxLength: 15,
};

export const descriptionConstraints = {
  minLength: 1,
  maxLength: 500,
};

export const websiteUrlConstraints = {
  maxLength: 100,
  match: /^https:\/\/([a-zA-Z0-9_-]+\.)+[a-zA-Z0-9_-]+(\/[a-zA-Z0-9_-]+)*\/?$/,
};

@Entity({ name: 'blogs' })
@Check(
  'CHK_name_length',
  `char_length(name) >= ${nameConstraints.minLength} AND char_length(name) <= ${nameConstraints.maxLength}`,
)
@Check(
  'CHK_description_length',
  `char_length(description) >= ${descriptionConstraints.minLength} AND char_length(description) <= ${descriptionConstraints.maxLength}`,
)
@Check('CHK_websiteUrl_pattern', `"websiteUrl" ~ '${websiteUrlConstraints.match.source}'`)
export class Blog extends BaseEntity {
  @Column({
    type: 'varchar',
    length: nameConstraints.maxLength,
    collation: 'C',
  })
  public name: string;

  @Column({
    type: 'varchar',
    length: descriptionConstraints.maxLength,
    collation: 'C',
  })
  description: string;

  @Column({
    type: 'varchar',
    length: websiteUrlConstraints.maxLength,
    collation: 'C',
  })
  websiteUrl: string;

  @Column({
    type: 'boolean',
    default: false,
  })
  isMembership: boolean;

  protected constructor() {
    super();
  }

  static create({ name, description, websiteUrl }: BlogInputDto): Blog {
    const blog = new this();

    blog.name = name;
    blog.description = description;
    blog.websiteUrl = websiteUrl;
    blog.isMembership = false;

    return blog;
  }

  public update({ name, description, websiteUrl }: BlogUpdateDto) {
    this.name = name;
    this.description = description;
    this.websiteUrl = websiteUrl;
  }

  @OneToMany(() => Post, (post: Post) => post.blog)
  posts: Post[];
}
