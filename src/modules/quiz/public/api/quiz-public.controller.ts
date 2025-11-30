import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
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
import { GetCurrentGameQuery } from '../application/queries/get-current-game.query-handler';
import { PaginatedViewDto } from '../../../../core/dto/paginated.view-dto';
import { GetGamesQueryParams } from './input-dto/get-games-query-params.input-dto';
import { GetAllGamesForUserQuery } from '../application/queries/get-all-games-for-user.query-handler';
import { StatisticViewDto } from './view-dto/statistic.view-dto';
import { GetMyStatisticQuery } from '../application/queries/get-satistic-for-user.query-handler';

@Controller('pair-game-quiz')
@UseGuards(JwtAuthGuard)
export class QuizPublicController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly gamesQueryRepository: GamesQueryRepository,
  ) {}

  @Get('pairs/my')
  async getAllGamesForUser(
    @ExtractUserFromRequest() { id: userId }: UserContextDto,
    @Query() query: GetGamesQueryParams,
  ): Promise<PaginatedViewDto<GameViewDto>> {
    return this.queryBus.execute(new GetAllGamesForUserQuery(query, userId));
  }

  @Get('users/my-statistic')
  async getMyStatistic(
    @ExtractUserFromRequest() { id: userId }: UserContextDto,
  ): Promise<StatisticViewDto> {
    return this.queryBus.execute(new GetMyStatisticQuery(userId));
  }

  @Get('pairs/my-current')
  async getCurrentGameForUser(
    @ExtractUserFromRequest() { id: userId }: UserContextDto,
  ): Promise<GameViewDto> {
    return this.queryBus.execute(new GetCurrentGameQuery(userId));
  }

  @Get('pairs/:id')
  async getGameById(
    @ExtractUserFromRequest() { id: userId }: UserContextDto,
    @Param('id', ParseIntPipe) gameId: number,
  ): Promise<GameViewDto> {
    return this.queryBus.execute(new GetGameQuery(userId, gameId));
  }

  @Post('pairs/connection')
  @HttpCode(HttpStatus.OK)
  async connectToGame(@ExtractUserFromRequest() { id }: UserContextDto): Promise<GameViewDto> {
    const idConnectedGame: number = await this.commandBus.execute(new ConnectToGameCommand(id));

    return this.gamesQueryRepository.getByIdOrNotFoundFail(idConnectedGame);
  }

  @Post('pairs/my-current/answers')
  @HttpCode(HttpStatus.OK)
  async recordAnswer(
    @ExtractUserFromRequest() { id: userId }: UserContextDto,
    @Body() { answer }: AnswerInputDto,
  ): Promise<AnswerViewDto> {
    return this.commandBus.execute(new RecordAnswerCommand(userId, answer));
  }
}
