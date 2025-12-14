import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { GLOBAL_PREFIX } from './global-prefix.setup';

export function swaggerSetup(app: INestApplication, isSwaggerEnabled: boolean) {
  if (isSwaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle('Blogger Platform API')
      .setDescription(`
# Blogger Platform API - V1

## OAS3

### Recent Changes
- **Quiz Logic Update**: When first player finishes all questions, second player gets **10 seconds** to answer remaining questions
- If time expires → game ends and unanswered questions marked as incorrect

---

## API Sections

### [Auth]
- Registration with email confirmation
- Login with JWT tokens (access + refresh)
- Password recovery
- Token refresh with automatic rotation
- Logout with token revocation
- Get current user profile

### [Blogs]
- Get all blogs with pagination
- Get blog by ID
- Get posts for specific blog

### [Comments]
- Get comment by ID
- Update comment
- Delete comment
- Like/dislike comments (5 reaction types)

### [PairQuizGame]
- Connect to random opponent or create new game
- Send answers for quiz questions
- Get current unfinished game
- Get all player games history
- Get player statistics
- Get top players leaderboard
- Get game by ID

### [Posts]
- Get all posts with pagination
- Get post by ID
- Get comments for post
- Create comment on post
- Like/dislike posts (5 reaction types)

### [SecurityDevices]
- Get all active devices/sessions
- Terminate all other sessions
- Terminate specific device session

### [Testing]
- Clear all database data

---

## Authentication Types

### JWT Access Token (Bearer)
- Used for most protected endpoints
- Sent in header: \`Authorization: Bearer <token>\`
- Short expiration (typically 15 minutes)

### JWT Refresh Token (Cookie)
- Used for token refresh and logout
- Automatically sent via httpOnly cookie \`refreshToken\`
- Long expiration (typically 7-30 days)

### Basic Auth
- Used for testing endpoints
- Username: admin, Password: qwerty

---
      `)
      .setVersion('1.0')
      .addTag('Auth', 'User authentication endpoints')
      .addTag('Blogs', 'Blog management endpoints')
      .addTag('Comments', 'Comment management endpoints')
      .addTag('PairQuizGame', 'Pair quiz game endpoints')
      .addTag('Posts', 'Post management endpoints')
      .addTag('SecurityDevices', 'Device session management endpoints')
      .addTag('Testing', 'Testing utility endpoints')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'JWT',
          description: 'JWT Access Token (Bearer)',
          in: 'header',
        },
        'JWT-auth',
      )
      .addCookieAuth(
        'refreshToken',
        {
          type: 'apiKey',
          in: 'cookie',
          name: 'refreshToken',
          description: 'JWT Refresh Token in httpOnly cookie',
        },
        'JWT-refresh',
      )
      .addBasicAuth(
        {
          type: 'http',
          scheme: 'basic',
          name: 'Basic',
          description: 'Basic Authentication (admin:qwerty)',
        },
        'Basic-auth',
      )
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup(GLOBAL_PREFIX, app, document, {
      customSiteTitle: 'Blogger Platform Swagger',
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        deepLinking: true,
      },
    });
  }
}
