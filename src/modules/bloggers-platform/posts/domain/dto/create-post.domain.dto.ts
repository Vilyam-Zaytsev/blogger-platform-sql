export class CreatePostDomainDto {
  constructor(
    public readonly title: string,
    public readonly shortDescription: string,
    public readonly content: string,
    public readonly blogId: number,
    public readonly blogName: string,
  ) {}
}
