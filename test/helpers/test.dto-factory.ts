import { UserInputDto } from '../../src/modules/user-accounts/users/api/input-dto/user.input-dto';
import { PostInputDto } from '../../src/modules/bloggers-platform/posts/api/input-dto/post.input-dto';
import { CommentInputDto } from 'src/modules/bloggers-platform/comments/api/input-dto/comment-input.dto';
import { BlogInputDto } from '../../src/modules/bloggers-platform/blogs/api/input-dto/blog.input-dto';
import { QuestionInputDto } from '../../src/modules/quiz/admin/api/input-dto/question.input-dto';

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

  static generatePostInputDto(quantity: number): PostInputDto[] {
    const dtos: PostInputDto[] = [];

    for (let i = 0; i < quantity; i++) {
      dtos.push({
        title: `testTitle${i}`,
        shortDescription: `test shortDescription post - ${i}`,
        content: `test content post - ${i}`,
      });
    }

    return dtos;
  }

  static generateCommentInputDto(quantity: number): CommentInputDto[] {
    const dtos: CommentInputDto[] = [];

    for (let i = 0; i < quantity; i++) {
      dtos.push({
        content: `test comment content - ${i}`,
      });
    }

    return dtos;
  }

  static generateQuestionInputDto(quantity: number): QuestionInputDto[] {
    const dtos: QuestionInputDto[] = [];

    for (let i = 0; i < quantity; i++) {
      dtos.push({
        body: `Test question ${i + 1}: What is the answer to question ${i + 1}?`,
        correctAnswers: [`Answer ${i + 1}`, `Correct ${i + 1}`],
      });
    }

    return dtos;
  }
}
