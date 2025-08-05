export class UpdateBlogDto {
  constructor(
    public readonly id: number,
    public readonly name: string,
    public readonly description: string,
    public readonly websiteUrl: string,
  ) {}
}
