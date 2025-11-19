import { IsEnum } from 'class-validator';
import { BaseQueryParams } from '../../../../../core/dto/base.query-params.input-dto';

export enum PostsSortBy {
  CreatedAt = 'createdAt',
  UpdatedAt = 'updatedAt',
  DeletedAt = 'deletedAt',
  Title = 'title',
  BlogId = 'blogId',
  BlogName = 'blogName',
}

// TODO: временное решение
export enum PostsSortBy_DB {
  createdAt = 'created_at',
  updatedAt = 'updated_at',
  deletedAt = 'deleted_at',
  title = 'title',
  blogId = 'blog_id',
  blogName = 'name',
}

export class GetPostsQueryParams extends BaseQueryParams<PostsSortBy> {
  @IsEnum(PostsSortBy)
  sortBy: PostsSortBy = PostsSortBy.CreatedAt;
}
