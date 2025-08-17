import { BlogInputDto } from '../api/input-dto/blog-input.dto';

export class CreateBlogDto {
  public readonly name: string;
  public readonly description: string;
  public readonly websiteUrl: string;
  public readonly isMembership: boolean;

  constructor(dto: BlogInputDto) {
    this.name = dto.name;
    this.description = dto.description;
    this.websiteUrl = dto.websiteUrl;
    this.isMembership = false;
  }
}
