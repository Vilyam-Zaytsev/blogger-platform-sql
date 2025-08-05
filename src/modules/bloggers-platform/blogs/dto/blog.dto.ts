export class CreateBlogDto {
  constructor(
    public name: string,
    public description: string,
    public websiteUrl: string,
  ) {}
}

export class UpdateBlogDto extends CreateBlogDto {}
