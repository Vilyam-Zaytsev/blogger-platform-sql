import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { GameViewDto } from '../../api/view-dto/game.view-dto';
import { Game } from '../../domain/entities/game.entity';
import { GameRole } from '../../domain/entities/player.entity';
import { RawGame } from './types/raw-game.type';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';

@Injectable()
export class GamesQueryRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async getById(id: number): Promise<GameViewDto> {
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
        'answers', COALESCE(
          json_agg(
            json_build_object(
              'questionId', q_a1.public_id,
              'answerStatus', a1.status,
              'addedAt', a1.added_at
            ) ORDER BY a1.added_at ASC
          ) FILTER (WHERE a1.id IS NOT NULL AND a1.player_id = p1.id),
          '[]'
        ),
        'player', json_build_object(
          'id', p1.id,
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
        'answers', COALESCE(
          json_agg(
            json_build_object(
              'questionId', q_a2.public_id,
              'answerStatus', a2.status,
              'addedAt', a2.added_at
            ) ORDER BY a2.added_at ASC
          ) FILTER (WHERE a2.id IS NOT NULL AND a2.player_id = p2.id),
          '[]'
        ),
        'player', json_build_object(
          'id', p2.id,
          'login', u2.login
        ),
        'score', p2.score
        )`,
        'secondPlayerProgress',
      )

      // Вопросы
      .addSelect(
        `COALESCE(
          json_agg(
            json_build_object(
              'id', q_gq.public_id,
              'body', q_gq.body
            ) ORDER BY gq.order ASC
          ) FILTER (WHERE gq.id IS NOT NULL),
          '[]'
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

      // Для ответов игрока 1
      .leftJoin('answers', 'a1', 'a1.player_id = p1.id')
      .leftJoin('game_questions', 'gq_a1', 'gq_a1.id = a1.game_question_id')
      .leftJoin('questions', 'q_a1', 'q_a1.id = gq_a1.question_id')

      // Для ответов игрока 2
      .leftJoin('answers', 'a2', 'a2.player_id = p2.id')
      .leftJoin('game_questions', 'gq_a2', 'gq_a2.id = a2.game_question_id')
      .leftJoin('questions', 'q_a2', 'q_a2.id = gq_a2.question_id')

      // Для вопросов
      .leftJoin('game_questions', 'gq', 'gq.game_id = g.id')
      .leftJoin('questions', 'q_gq', 'q_gq.id = gq.question_id')

      .where('g.id = :id', { id })
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
