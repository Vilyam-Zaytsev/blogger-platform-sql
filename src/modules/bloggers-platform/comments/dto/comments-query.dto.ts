import { GetCommentsQueryParams } from '../api/input-dto/get-comments-query-params.input-dto';

export class CommentsQueryDto {
  commentId: number;
  userId: number | null;
  query: GetCommentsQueryParams;
}
