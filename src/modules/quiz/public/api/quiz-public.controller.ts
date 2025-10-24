import { Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../user-accounts/auth/domain/guards/bearer/jwt-auth.guard';
import { ExtractUserFromRequest } from '../../../user-accounts/auth/domain/guards/decorators/extract-user-from-request.decorator';
import { UserContextDto } from '../../../user-accounts/auth/domain/guards/dto/user-context.dto';
import { GameViewDto } from './view-dto/game.view-dto';

@Controller('pair-game-quiz/pairs')
@UseGuards(JwtAuthGuard)
export class QuizPublicController {
  constructor() {}

  @Post('connection')
  async connectToGame(@ExtractUserFromRequest() user: UserContextDto): Promise<GameViewDto> {
    return {} as GameViewDto;
  }
}
