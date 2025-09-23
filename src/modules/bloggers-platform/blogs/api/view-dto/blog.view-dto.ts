import { Blog } from '../../domain/entities/blog.entity';
import { RawBlog } from '../../infrastructure/dto/raw-blog.type';

export class BlogViewDto {
  id: string;
  name: string;
  description: string;
  websiteUrl: string;
  createdAt: string;
  isMembership: boolean;

  //TODO: нормально ли так расширять тип?
  static mapToView(blog: Blog | RawBlog): BlogViewDto {
    const dto = new this();

    dto.id = blog.id.toString();
    dto.name = blog.name;
    dto.description = blog.description;
    dto.websiteUrl = blog.websiteUrl;
    dto.createdAt = blog.createdAt.toISOString();
    dto.isMembership = blog.isMembership;

    return dto;
  }
}
