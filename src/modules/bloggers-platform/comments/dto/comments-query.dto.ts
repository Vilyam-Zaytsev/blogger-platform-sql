import { GetCommentsQueryParams } from '../api/input-dto/get-comments-query-params.input-dto';

export class CommentsQueryDto {
  query: GetCommentsQueryParams;
  postId: number;
  userId: number | null;
}
