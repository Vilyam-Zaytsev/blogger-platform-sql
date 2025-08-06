export class CreateBlogDto {
  constructor(
    public readonly name: string,
    public readonly description: string,
    public readonly websiteUrl: string,
    public readonly isMembership: boolean = false,
  ) {}
}
