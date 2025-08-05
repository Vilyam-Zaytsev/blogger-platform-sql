import { UserInputDto } from '../../src/modules/user-accounts/users/api/input-dto/user.input-dto';
import { BlogInputDto } from '../../src/modules/bloggers-platform/blogs/api/input-dto/blog-input.dto';

export class TestDtoFactory {
  static generateUserInputDto(quantity: number): UserInputDto[] {
    const dtos: UserInputDto[] = [];

    for (let i = 0; i < quantity; i++) {
      dtos.push({
        login: `testUser${i}`,
        email: `testUser${i}@example.com`,
        password: 'qwerty',
      });
    }

    return dtos;
  }

  static generateBlogInputDto(quantity: number): BlogInputDto[] {
    const dtos: BlogInputDto[] = [];

    for (let i = 0; i < quantity; i++) {
      dtos.push({
        name: `testBlog${i}`,
        description: `test description blog - ${i}`,
        websiteUrl: `https://test.blog-${i}.com`,
      });
    }

    return dtos;
  }

  // static generatePostInputDto(
  //   quantity: number,
  //   blogId: string,
  // ): PostInputDto[] {
  //   const dtos: PostInputDto[] = [];
  //
  //   for (let i = 0; i < quantity; i++) {
  //     dtos.push({
  //       title: `testTitle${i}`,
  //       shortDescription: `test shortDescription post - ${i}`,
  //       content: `test content post - ${i}`,
  //       blogId,
  //     });
  //   }
  //
  //   return dtos;
  // }
  //
  // static generateCommentInputDto(quantity: number): CommentInputDto[] {
  //   const dtos: CommentInputDto[] = [];
  //
  //   for (let i = 0; i < quantity; i++) {
  //     dtos.push({
  //       content: `test comment content - ${i}`,
  //     });
  //   }
  //
  //   return dtos;
  // }
}
