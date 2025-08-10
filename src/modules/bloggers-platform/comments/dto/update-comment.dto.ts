export class UpdateCommentDto {
  constructor(
    public readonly commentId: number,
    private readonly userId: number,
    public readonly content: string,
  ) {}
}
