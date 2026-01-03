import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../../../core/repositories/base.repository';
import { Game, GameStatus } from '../domain/entities/game.entity';
import { GameProgress } from './types/game-progress.type';
import { TransactionHelper } from '../../../../trasaction.helper';
import { EntityManager } from 'typeorm';
import { GameQuestion } from '../domain/entities/game-question.entity';
import { Answer } from '../domain/entities/answer.entity';

@Injectable()
export class GamesRepository extends BaseRepository<Game> {
  constructor(protected readonly transactionHelper: TransactionHelper) {
    super(Game, transactionHelper);
  }

  async getByIdWithLock(id: number): Promise<Game | null> {
    return this.getRepository()
      .createQueryBuilder('g')
      .where('g.id = :id', { id })
      .setLock('pessimistic_write')
      .getOne();
  }

  async getGameInPendingWithLock(): Promise<Game | null> {
    return this.getRepository()
      .createQueryBuilder('g')
      .where('g.status = :status', { status: GameStatus.Pending })
      .setLock('pessimistic_write')
      .getOne();
  }

  async getGameProgressByUserIdWithLock(userId: number): Promise<GameProgress | null> {
    const qb = this.getRepository()
      .createQueryBuilder('g')
      .select('g.id', 'gameId')
      .addSelect(
        `(
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'gameQuestionId', gq_sub.id,
            'questionPublicId', q_sub.public_id,
            'body', q_sub.body,
            'order', gq_sub.order,
            'correctAnswers', q_sub.correct_answers
          ) ORDER BY gq_sub.order ASC
        ),
        '[]'
      )
      FROM game_questions gq_sub
      LEFT JOIN questions q_sub ON q_sub.id = gq_sub.question_id
      WHERE gq_sub.game_id = g.id
    )`,
        'questions',
      )
      .addSelect(
        `(
        SELECT jsonb_build_object(
          'playerId', p_current.id,
          'answers', COALESCE(
            jsonb_agg(
              jsonb_build_object(
                'status', a_current.status,
                'addedAt', a_current.added_at
              ) ORDER BY a_current.added_at ASC
            ) FILTER (WHERE a_current.id IS NOT NULL),
            '[]'
          ),
          'score', p_current.score
        )
        FROM players p_current
        LEFT JOIN answers a_current ON a_current.player_id = p_current.id
        WHERE p_current.game_id = g.id
          AND p_current.user_id = :userId
        GROUP BY p_current.id, p_current.score
      )`,
        'progressCurrentPlayer',
      )
      .addSelect(
        `(
        SELECT jsonb_build_object(
          'playerId', p_opponent.id,
          'answers', COALESCE(
            jsonb_agg(
              jsonb_build_object(
                'status', a_opponent.status,
                'addedAt', a_opponent.added_at
              ) ORDER BY a_opponent.added_at ASC
            ) FILTER (WHERE a_opponent.id IS NOT NULL),
            '[]'
          ),
          'score', p_opponent.score
        )
        FROM players p_opponent
        LEFT JOIN answers a_opponent ON a_opponent.player_id = p_opponent.id
        WHERE p_opponent.game_id = g.id
          AND p_opponent.user_id != :userId
        GROUP BY p_opponent.id, p_opponent.score
      )`,
        'progressOpponent',
      )
      .where('g.status = :status', { status: GameStatus.Active })
      .andWhere(
        `EXISTS (
      SELECT 1 FROM players p_check
      WHERE p_check.game_id = g.id
        AND p_check.user_id = :userId
    )`,
      )
      .setParameter('userId', userId)
      .setLock('pessimistic_write');

    return (await qb.getRawOne()) ?? null;
  }

  async getGameProgressByUserId(userId: number): Promise<GameProgress | null> {
    const qb = this.getRepository()
      .createQueryBuilder('g')

      .select('g.id', 'gameId')

      .addSelect(
        `(
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'gameQuestionId', gq_sub.id,
            'questionPublicId', q_sub.public_id,
            'body', q_sub.body,
            'order', gq_sub.order,
            'correctAnswers', q_sub.correct_answers
          ) ORDER BY gq_sub.order ASC
        ),
        '[]'
      )
      FROM game_questions gq_sub
      LEFT JOIN questions q_sub ON q_sub.id = gq_sub.question_id
      WHERE gq_sub.game_id = g.id
    )`,
        'questions',
      )

      .addSelect(
        `(
        SELECT jsonb_build_object(
          'playerId', p_current.id,
          'answers', COALESCE(
            jsonb_agg(
              jsonb_build_object(
                'status', a_current.status,
                'addedAt', a_current.added_at
              ) ORDER BY a_current.added_at ASC
            ) FILTER (WHERE a_current.id IS NOT NULL),
            '[]'
          ),
          'score', p_current.score
        )
        FROM players p_current
        LEFT JOIN answers a_current ON a_current.player_id = p_current.id
        WHERE p_current.game_id = g.id
          AND p_current.user_id = :userId
        GROUP BY p_current.id, p_current.score
      )`,
        'progressCurrentPlayer',
      )

      .addSelect(
        `(
        SELECT jsonb_build_object(
          'playerId', p_opponent.id,
          'answers', COALESCE(
            jsonb_agg(
              jsonb_build_object(
                'status', a_opponent.status,
                'addedAt', a_opponent.added_at
              ) ORDER BY a_opponent.added_at ASC
            ) FILTER (WHERE a_opponent.id IS NOT NULL),
            '[]'
          ),
          'score', p_opponent.score
        )
        FROM players p_opponent
        LEFT JOIN answers a_opponent ON a_opponent.player_id = p_opponent.id
        WHERE p_opponent.game_id = g.id
          AND p_opponent.user_id != :userId
        GROUP BY p_opponent.id, p_opponent.score
      )`,
        'progressOpponent',
      )

      .where('g.status = :status', { status: GameStatus.Active })
      .andWhere(
        `EXISTS (
      SELECT 1 FROM players p_check
      WHERE p_check.game_id = g.id
        AND p_check.user_id = :userId
    )`,
      )
      .setParameter('userId', userId);

    return (await qb.getRawOne()) ?? null;
  }

  async saveGameQuestion(gameQuestion: GameQuestion): Promise<number> {
    const manager: EntityManager = this.transactionHelper.getManager();
    const { id }: GameQuestion = await manager.save(GameQuestion, gameQuestion);

    return id;
  }

  async saveAnswer(answer: Answer): Promise<Answer> {
    const manager: EntityManager = this.transactionHelper.getManager();
    return await manager.save(Answer, answer);
  }
}
