import { RawComment } from '../../infrastructure/query/types/raw-comment.type';
import { ReactionStatus } from '../../../reactions/domain/entities/reaction.entity';

export type CommentatorInfo = {
  userId: string;
  userLogin: string;
};

export type ReactionsInfo = {
  likesCount: number;
  dislikesCount: number;
  myStatus: ReactionStatus;
};

export class CommentViewDto {
  id: string;
  content: string;
  commentatorInfo: CommentatorInfo;
  likesInfo: ReactionsInfo;
  createdAt: string;

  static mapRawCommentToCommentViewDto(comment: RawComment): CommentViewDto {
    const dto = new this();

    dto.id = comment.id.toString();
    dto.content = comment.content;
    dto.commentatorInfo = {
      userId: comment.userId.toString(),
      userLogin: comment.userLogin,
    };
    dto.likesInfo = {
      likesCount: +comment.likesCount,
      dislikesCount: +comment.dislikesCount,
      myStatus: comment.myStatus ?? ReactionStatus.None,
    };
    dto.createdAt = comment.createdAt.toISOString();

    return dto;
  }
}
