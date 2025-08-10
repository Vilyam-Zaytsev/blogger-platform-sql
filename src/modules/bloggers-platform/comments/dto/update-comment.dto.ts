export class UpdateCommentDto {
  constructor(
    public readonly commentId: number,
    public readonly userId: number,
    public readonly content: string,
  ) {}
}
