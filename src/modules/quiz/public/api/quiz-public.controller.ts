import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../user-accounts/auth/domain/guards/bearer/jwt-auth.guard';
import { ExtractUserFromRequest } from '../../../user-accounts/auth/domain/guards/decorators/extract-user-from-request.decorator';
import { UserContextDto } from '../../../user-accounts/auth/domain/guards/dto/user-context.dto';
import { GameViewDto } from './view-dto/game.view-dto';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ConnectToGameCommand } from '../application/usecases/connect-to-game.usecase';
import { GamesQueryRepository } from '../infrastructure/query/games.query-repository';
import { AnswerInputDto } from './input-dto/answer.input-dto';
import { AnswerViewDto } from './view-dto/answer.view-dto';
import { RecordAnswerCommand } from '../application/usecases/record-answer.usecase';
import { GetGameQuery } from '../application/queries/get-game.query-handler';
import { TypeId } from '../application/types/type-id.type';

@Controller('pair-game-quiz/pairs')
@UseGuards(JwtAuthGuard)
export class QuizPublicController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly gamesQueryRepository: GamesQueryRepository,
  ) {}

  @Post('connection')
  async connectToGame(@ExtractUserFromRequest() { id }: UserContextDto): Promise<GameViewDto> {
    const idConnectedGame: number = await this.commandBus.execute(new ConnectToGameCommand(id));

    return this.gamesQueryRepository.getByIdOrNotFoundFail(idConnectedGame, TypeId.id);
  }

  @Post('my-current/answers')
  async recordAnswer(
    @ExtractUserFromRequest() { id: userId }: UserContextDto,
    @Body() { answer }: AnswerInputDto,
  ): Promise<AnswerViewDto> {
    return this.commandBus.execute(new RecordAnswerCommand(userId, answer));
  }

  @Get(':id')
  async getGameById(
    @ExtractUserFromRequest() { id: userId }: UserContextDto,
    @Param('id', ParseUUIDPipe) gameId: string,
  ): Promise<GameViewDto> {
    return this.queryBus.execute(new GetGameQuery(userId, gameId));
  }
}
