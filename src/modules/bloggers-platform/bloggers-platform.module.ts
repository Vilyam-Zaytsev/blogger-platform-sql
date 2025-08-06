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

@Module({
  imports: [UserAccountsModule],
  controllers: [BlogsAdminController, BlogsPublicController],
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
