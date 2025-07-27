import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { JwtRefreshAuthGuard } from '../../auth/domain/guards/bearer/jwt-refresh-auth.guard';
import { ExtractSessionFromRequest } from '../../auth/domain/guards/decorators/extract-session-from-request.decorator';
import { SessionContextDto } from '../../auth/domain/guards/dto/session-context.dto';
import { SessionViewDto } from './view-dto/session.view-dto';

@Controller('security/devices')
@UseGuards(JwtRefreshAuthGuard)
export class SessionsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  async getAll(
    @ExtractSessionFromRequest() session: SessionContextDto,
  ): Promise<SessionViewDto> {
    return this.queryBus.execute(new GetSessionsQuery(session));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSession(
    @ExtractSessionFromRequest() session: SessionContextDto,
    @Param() params: IdInputDto,
  ): Promise<void> {
    return this.commandBus.execute(
      new DeleteSessionCommand(session, params.id),
    );
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSessions(
    @ExtractSessionFromRequest() session: SessionContextDto,
  ): Promise<void> {
    return this.commandBus.execute(new DeleteSessionsCommand(session));
  }
}
