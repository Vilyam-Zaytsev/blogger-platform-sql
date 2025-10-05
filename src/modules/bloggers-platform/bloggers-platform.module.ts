import { Module } from '@nestjs/common';
import { UserAccountsModule } from '../user-accounts/user-accounts.module';
import { BlogsAdminController } from './blogs/api/blogs.admin-controller';
import { BlogsRepository } from './blogs/infrastructure/blogs.repository';
import { BlogsQueryRepository } from './blogs/infrastructure/query/blogs.query-repository';
import { CreateBlogUseCase } from './blogs/application/usecases/create-blog.usecase';
import { GetBlogQueryHandler } from './blogs/application/queries/get-blog.query-handler';
import { GetBlogsQueryHandler } from './blogs/application/queries/get-blogs.query-handler';
import { UpdateBlogUseCase } from './blogs/application/usecases/update-blog.usecase';
import { DeleteBlogUseCase } from './blogs/application/usecases/delete-blog.usecase';
import { BlogsPublicController } from './blogs/api/blogs.public-controller';
import { PostsRepository } from './posts/infrastructure/posts.repository';
import { CreatePostUseCase } from './posts/application/usecases/create-post.usecase';
import { PostsQueryRepository } from './posts/infrastructure/query/posts.query-repository';
import { PostsController } from './posts/api/posts.controller';
import { GetPostsForBlogQueryHandler } from './posts/application/queries/get-posts-for-blog.query-handler';
import { UpdatePostUseCase } from './posts/application/usecases/update-post.usecase';
import { DeletePostUseCase } from './posts/application/usecases/delete-post.usecase';
import { GetPostsQueryHandler } from './posts/application/queries/get-posts.query-handler';
import { GetPostQueryHandler } from './posts/application/queries/get-post.query-handler';
import { CommentsRepository } from './comments/infrastructure/comments-repository';
import { UpdateCommentUseCase } from './comments/application/usecases/update-comment.usecase';
import { CommentsController } from './comments/api/comments.controller';
import { DeleteCommentUseCase } from './comments/application/usecases/delete-comment.usecase';
import { CreateCommentUseCase } from './comments/application/usecases/create-comment.usecase';
import { CommentsQueryRepository } from './comments/infrastructure/query/comments.query-repository';
import { GetCommentQueryHandler } from './comments/application/queries/get-comment.query-handler';
import { GetCommentsQueryHandler } from './comments/application/queries/get-comments.query-handler';
import { UpdatePostReactionUseCase } from './reactions/application/usecases/update-post-reaction.usecase';
import { UpdateCommentReactionUseCase } from './comments/application/usecases/update-comment-reaction.usecase';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Blog } from './blogs/domain/entities/blog.entity';
import { Post } from './posts/domain/entities/post.entity';
import { Reaction } from './reactions/domain/entities/reaction.entity';
import { ReactionPost } from './reactions/domain/entities/reaction-post.entity';
import { ReactionsRepository } from './reactions/infrastructure/reactions.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Blog, Post, Reaction, ReactionPost]), UserAccountsModule],
  controllers: [BlogsAdminController, BlogsPublicController, PostsController, CommentsController],
  providers: [
    //🔸 Blogs:
    //repo
    BlogsRepository,
    BlogsQueryRepository,
    //use-cases
    CreateBlogUseCase,
    UpdateBlogUseCase,
    DeleteBlogUseCase,
    //query-handlers
    GetBlogsQueryHandler,
    GetBlogQueryHandler,
    //🔸 Posts:
    //repo
    PostsRepository,
    PostsQueryRepository,
    //use-cases
    CreatePostUseCase,
    UpdatePostUseCase,
    DeletePostUseCase,
    UpdatePostReactionUseCase,
    //query-handlers
    GetPostsForBlogQueryHandler,
    GetPostsQueryHandler,
    GetPostQueryHandler,
    //🔸 Comments:
    //repo
    CommentsRepository,
    CommentsQueryRepository,
    // //use-cases
    CreateCommentUseCase,
    UpdateCommentUseCase,
    DeleteCommentUseCase,
    UpdateCommentReactionUseCase,
    //query-handlers
    GetCommentQueryHandler,
    GetCommentsQueryHandler,
    //🔸 Reactions:
    //repo
    ReactionsRepository,
  ],
  exports: [],
})
export class BloggersPlatformModule {}
