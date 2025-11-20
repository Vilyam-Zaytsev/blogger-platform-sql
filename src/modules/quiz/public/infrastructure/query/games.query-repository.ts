import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { GameViewDto } from '../../api/view-dto/game.view-dto';
import { Game } from '../../domain/entities/game.entity';
import { GameRole } from '../../domain/entities/player.entity';
import { RawGame } from './types/raw-game.type';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';
import { TypeId } from '../../../types/type-id.type';

@Injectable()
export class GamesQueryRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async getByIdOrNotFoundFail(id: number | string, typeId: TypeId): Promise<GameViewDto> {
    const qb = this.dataSource
      .getRepository<Game>(Game)
      .createQueryBuilder('g')

      // Игра
      .select('g.public_id', 'id')
      .addSelect('g.created_at', 'pairCreatedDate')
      .addSelect('g.start_game_date', 'startGameDate')
      .addSelect('g.finish_game_date', 'finishGameDate')
      .addSelect('g.status', 'status')

      // Игрок 1
      .addSelect(
        `json_build_object(
        'answers', (
          SELECT COALESCE(
          json_agg(
            json_build_object(
              'questionId', q_a1.public_id,
              'answerStatus', a1.status,
              'addedAt', to_char(a1.added_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
            ) ORDER BY a1.added_at ASC
          ),
          '[]'
        )
        FROM answers a1
        LEFT JOIN game_questions gq_a1 ON gq_a1.id = a1.game_question_id
        LEFT JOIN questions q_a1 ON q_a1.id = gq_a1.question_id
        WHERE a1.player_id = p1.id
        ),
        'player', json_build_object(
          'id', u1.id,
          'login', u1.login
        ),
        'score', p1.score
        )`,
        'firstPlayerProgress',
      )

      // Игрок 2
      .addSelect(
        `CASE
                   WHEN p2.id IS NULL THEN NULL
                   ELSE json_build_object(
        'answers', (
          SELECT COALESCE(
          json_agg(
            json_build_object(
              'questionId', q_a2.public_id,
              'answerStatus', a2.status,
              'addedAt', to_char(a2.added_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
            ) ORDER BY a2.added_at ASC
          ),
          '[]'
        )
        FROM answers a2
        LEFT JOIN game_questions gq_a2 ON gq_a2.id = a2.game_question_id
        LEFT JOIN questions q_a2 ON q_a2.id = gq_a2.question_id
        WHERE a2.player_id = p2.id
        ),
        'player', json_build_object(
          'id', u2.id,
          'login', u2.login
        ),
        'score', p2.score
        )
        END`,
        'secondPlayerProgress',
      )

      // Вопросы
      .addSelect(
        `(
        SELECT COALESCE(
          json_agg(
            json_build_object(
              'id', q_gq.public_id,
              'body', q_gq.body
            ) ORDER BY gq_sub.order ASC
          ),
          '[]'
        )
        FROM game_questions gq_sub
        LEFT JOIN questions q_gq ON q_gq.id = gq_sub.question_id
        WHERE gq_sub.game_id = g.id
      )`,
        'questions',
      )

      // Для игрока 1
      .leftJoin('players', 'p1', 'p1.game_id = g.id AND p1.role = :hostRole', {
        hostRole: GameRole.Host,
      })
      .leftJoin('users', 'u1', 'u1.id = p1.user_id')

      // Для игрока 2
      .leftJoin('players', 'p2', 'p2.game_id = g.id AND p2.role = :playerRole', {
        playerRole: GameRole.Player,
      })
      .leftJoin('users', 'u2', 'u2.id = p2.user_id')

      .where(`g.${typeId} = :id`, { id })

      .groupBy('g.id')
      .addGroupBy('p1.id')
      .addGroupBy('u1.id')
      .addGroupBy('p2.id')
      .addGroupBy('u2.id');

    const rawGame: RawGame | null = (await qb.getRawOne()) ?? null;

    if (!rawGame) {
      throw new DomainException({
        code: DomainExceptionCode.NotFound,
        message: `The post with ID (${id}) does not exist`,
      });
    }
    return GameViewDto.mapToView(rawGame);
  }
}
