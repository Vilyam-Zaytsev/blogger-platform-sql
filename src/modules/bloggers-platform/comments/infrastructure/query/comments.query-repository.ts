import { Injectable } from '@nestjs/common';
import { CommentViewDto } from '../../api/view-dto/comment-view.dto';
import { PaginatedViewDto } from '../../../../../core/dto/paginated.view-dto';
import { UserContextDto } from '../../../../user-accounts/auth/domain/guards/dto/user-context.dto';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ReactionStatus } from '../../../reactions/domain/entities/reaction.entity';
import { Comment } from '../../domain/entities/comment.entity';
import { RawComment } from './types/raw-comment.type';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';
import { GetCommentsQueryParams } from '../../api/input-dto/get-comments-query-params.input-dto';

@Injectable()
export class CommentsQueryRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async getByIdOrNotFoundFail(id: number, user: UserContextDto | null): Promise<CommentViewDto> {
    const likesCountQueryBuilder = this.dataSource
      .createQueryBuilder()
      .select('rc."commentId"', 'commentId')
      .addSelect('COUNT(*)', 'count')
      .from('reactions_comments', 'rc')
      .innerJoin('reactions', 'r', 'r.id = rc."reactionId"')
      .where('r.status = :like', { like: ReactionStatus.Like })
      .groupBy('rc."commentId"');

    const dislikesCountQueryBuilder = this.dataSource
      .createQueryBuilder()
      .select('rc."commentId"', 'commentId')
      .addSelect('COUNT(*)', 'count')
      .from('reactions_comments', 'rc')
      .innerJoin('reactions', 'r', 'r.id = rc."commentId"')
      .where('r.status = :dislike', { dislike: ReactionStatus.Dislike })
      .groupBy('rc."commentId"');

    const mainQueryBuilder = this.dataSource
      .getRepository<Comment>(Comment)
      .createQueryBuilder('comment')
      .addCommonTableExpression(likesCountQueryBuilder, 'likes_count')
      .addCommonTableExpression(dislikesCountQueryBuilder, 'dislikes_count')
      .leftJoin('comment.user', 'user')
      .leftJoin('likes_count', 'lc', 'lc."commentId" = comment.id')
      .leftJoin('dislikes_count', 'dc', 'dc."commentId" = comment.id')
      .where('comment.id = :id', { id });

    mainQueryBuilder
      .select([
        'comment.id AS id',
        'comment.content AS content',
        'comment.createdAt AS "createdAt"',
        'user.id AS "userId"',
        'user.login AS "userLogin"',
      ])
      .addSelect('COALESCE(lc.count, 0)', 'likesCount')
      .addSelect('COALESCE(dc.count, 0)', 'dislikesCount');

    if (user?.id) {
      mainQueryBuilder.addSelect(
        (subQb) =>
          subQb
            .select('r.status')
            .from('reactions_comments', 'rc')
            .innerJoin(
              'reactions',
              'r',
              `
            r.id = rc."reactionId" 
            AND r.userId = :uid
            `,
              { uid: user.id },
            )
            .where('rc."commentId" = comment.id')
            .limit(1),
        'myStatus',
      );
    } else {
      mainQueryBuilder.addSelect(`'${ReactionStatus.None}'`, 'myStatus');
    }

    const rawComment: RawComment | null = (await mainQueryBuilder.getRawOne()) ?? null;

    if (!rawComment) {
      throw new DomainException({
        code: DomainExceptionCode.NotFound,
        message: `The comment with ID (${id}) does not exist`,
      });
    }

    return CommentViewDto.mapRawCommentToCommentViewDto(rawComment);
  }

  async getAll(
    query: GetCommentsQueryParams,
    postId: number,
    user: UserContextDto | null,
  ): Promise<PaginatedViewDto<CommentViewDto>> {
    const { sortBy, sortDirection, pageSize, pageNumber }: GetCommentsQueryParams = query;
    const skip: number = query.calculateSkip();

    const likesCountQueryBuilder = this.dataSource
      .createQueryBuilder()
      .select('rc."commentId"', 'commentId')
      .addSelect('COUNT(*)', 'count')
      .from('reactions_comments', 'rc')
      .innerJoin('reactions', 'r', 'r.id = rc."reactionId"')
      .where('r.status = :like', { like: ReactionStatus.Like })
      .groupBy('rc."commentId"');

    const dislikesCountQueryBuilder = this.dataSource
      .createQueryBuilder()
      .select('rc."commentId"', 'commentId')
      .addSelect('COUNT(*)', 'count')
      .from('reactions_comments', 'rc')
      .innerJoin('reactions', 'r', 'r.id = rc."reactionId"')
      .where('r.status = :dislike', { dislike: ReactionStatus.Dislike })
      .groupBy('rc."commentId"');

    const mainQueryBuilder = this.dataSource
      .getRepository<Comment>(Comment)
      .createQueryBuilder('comment')
      .addCommonTableExpression(likesCountQueryBuilder, 'likes_count')
      .addCommonTableExpression(dislikesCountQueryBuilder, 'dislikes_count')
      .leftJoin('comment.user', 'user')
      .leftJoin('likes_count', 'lc', 'lc."commentId" = comment.id')
      .leftJoin('dislikes_count', 'dc', 'dc."commentId" = comment.id')
      .where('comment.postId = :postId', { postId });

    mainQueryBuilder
      .select([
        'comment.id AS id',
        'comment.content AS content',
        'comment.createdAt AS "createdAt"',
        'user.id AS "userId"',
        'user.login AS "userLogin"',
      ])
      .addSelect('COALESCE(lc.count, 0)', 'likesCount')
      .addSelect('COALESCE(dc.count, 0)', 'dislikesCount');

    if (user?.id) {
      mainQueryBuilder.addSelect(
        (subQb) =>
          subQb
            .select('r.status')
            .from('reactions_comments', 'rc')
            .innerJoin(
              'reactions',
              'r',
              `
            r.id = rc."reactionId" 
            AND r.userId = :uid
            `,
              { uid: user.id },
            )
            .where('rc."commentId" = comment.id')
            .limit(1),
        'myStatus',
      );
    } else {
      mainQueryBuilder.addSelect(`'${ReactionStatus.None}'`, 'myStatus');
    }

    mainQueryBuilder
      .orderBy(`"${sortBy}"`, sortDirection.toUpperCase() as 'ASC' | 'DESC')
      .offset(skip)
      .limit(pageSize);

    const rawComments: RawComment[] = await mainQueryBuilder.getRawMany();
    const totalCount: number = await mainQueryBuilder.getCount();
    const pagesCount: number = Math.ceil(totalCount / pageSize);

    return {
      pagesCount,
      page: pageNumber,
      pageSize,
      totalCount,
      items: rawComments.map((comment) => CommentViewDto.mapRawCommentToCommentViewDto(comment)),
    };
  }
}
