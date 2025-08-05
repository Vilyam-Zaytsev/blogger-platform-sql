import { Module } from '@nestjs/common';
import { UserAccountsModule } from '../user-accounts/user-accounts.module';
import { BlogsController } from './blogs/api/blogs.sa-controller';
import { BlogsRepository } from './blogs/infrastructure/blogs.repository';
import { BlogsQueryRepository } from './blogs/infrastructure/query/blogs.query-repository';
import { CreateBlogUseCase } from './blogs/application/usecases/create-blog.usecase';

@Module({
  imports: [UserAccountsModule],
  controllers: [BlogsController],
  providers: [
    //🔸 Blogs:
    //repo
    BlogsRepository,
    BlogsQueryRepository,
    //use-cases
    CreateBlogUseCase,
    // UpdateBlogUseCase,
    // DeleteBlogUseCase,
    // //query-handlers
    // GetBlogsQueryHandler,
    // GetBlogQueryHandler,
    // GetPostsForBlogQueryHandler,
    // //🔸 Posts:
    // //repo
    // PostsRepository,
    // PostsQueryRepository,
    // //use-cases
    // CreatePostUseCase,
    // UpdatePostUseCase,
    // DeletePostUseCase,
    // UpdatePostReactionUseCase,
    // //query-handlers
    // GetPostsQueryHandler,
    // GetPostQueryHandler,
    // //🔸 Comments:
    // //repo
    // CommentsRepository,
    // CommentsQueryRepository,
    // //use-cases
    // CreateCommentUseCase,
    // UpdateCommentUseCase,
    // DeleteCommentUseCase,
    // UpdateCommentReactionUseCase,
    // //query-handlers
    // GetCommentQueryHandler,
    // GetCommentsQueryHandler,
    // //🔸 Reactions:
    // //repo
    // ReactionsRepository,
    // //use-cases
    // UpdateReactionUseCase,
    // CreateReactionUseCase,
  ],
  exports: [],
})
export class BloggersPlatformModule {}
