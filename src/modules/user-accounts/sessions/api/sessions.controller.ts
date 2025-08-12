import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { JwtRefreshAuthGuard } from '../../auth/domain/guards/bearer/jwt-refresh-auth.guard';
import { ExtractSessionFromRequest } from '../../auth/domain/guards/decorators/extract-session-from-request.decorator';
import { SessionContextDto } from '../../auth/domain/guards/dto/session-context.dto';
import { SessionViewDto } from './view-dto/session.view-dto';
import { GetSessionsQuery } from '../application/queries/get-sessions.query-handler';
import { DeleteSessionCommand } from '../application/usecases/delete-session.usecase';
import { DeleteSessionsCommand } from '../application/usecases/delete-sessions.usecase';

@Controller('security/devices')
@UseGuards(JwtRefreshAuthGuard)
export class SessionsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  async getAll(@ExtractSessionFromRequest() session: SessionContextDto): Promise<SessionViewDto> {
    return await this.queryBus.execute(new GetSessionsQuery(session));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSession(
    @ExtractSessionFromRequest() session: SessionContextDto,
    //TODO: как правильно провалидировать id в параметрах?

    // @Param('id', ParseUUIDPipe) id: string,
    @Param(
      'id',
      new ParseUUIDPipe({
        exceptionFactory: () => {
          return new NotFoundException('Session not found');
        },
      }),
    )
    id: string,
  ): Promise<void> {
    return await this.commandBus.execute(new DeleteSessionCommand(session, id));
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSessions(@ExtractSessionFromRequest() session: SessionContextDto): Promise<void> {
    return await this.commandBus.execute(new DeleteSessionsCommand(session));
  }
}
