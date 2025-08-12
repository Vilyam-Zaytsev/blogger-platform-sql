export class UpdateCommentContentDto {
  constructor(
    public readonly commentId: number,
    public readonly content: string,
  ) {}
}
