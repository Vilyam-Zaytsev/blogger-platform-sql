export class UpdatePostDto {
  constructor(
    public readonly postId: number,
    public readonly title: string,
    public readonly shortDescription: string,
    public readonly content: string,
  ) {}
}
