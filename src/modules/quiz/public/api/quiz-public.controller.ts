import { Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../user-accounts/auth/domain/guards/bearer/jwt-auth.guard';
import { ExtractUserFromRequest } from '../../../user-accounts/auth/domain/guards/decorators/extract-user-from-request.decorator';
import { UserContextDto } from '../../../user-accounts/auth/domain/guards/dto/user-context.dto';
import { GameViewDto } from './view-dto/game.view-dto';
import { CommandBus } from '@nestjs/cqrs';
import { ConnectToGameCommand } from '../application/usecases/connect-to-game.usecase';

@Controller('pair-game-quiz/pairs')
@UseGuards(JwtAuthGuard)
export class QuizPublicController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('connection')
  async connectToGame(@ExtractUserFromRequest() { id }: UserContextDto): Promise<GameViewDto> {
    const idConnectedGame: number = await this.commandBus.execute(new ConnectToGameCommand(id));

    return {} as GameViewDto;
  }
}
