import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../../../core/repositories/base.repository';
import { DataSource } from 'typeorm';
import { Game, GameStatus } from '../domain/entities/game.entity';
import { GameQuestion } from '../domain/entities/game-question.entity';
import { GameProgress } from './types/game-progress.type';
import { Answer } from '../domain/entities/answer.entity';

@Injectable()
export class GamesRepository extends BaseRepository<Game> {
  constructor(dataSource: DataSource) {
    super(dataSource, Game);
  }

  async getGameInPending(): Promise<Game | null> {
    return await this.repository.findOne({ where: { status: GameStatus.Pending } });
  }

  async getGameProgressByUserId(userId: number): Promise<GameProgress | null> {
    const qb = this.repository
      .createQueryBuilder('g')

      .select('g.id', 'gameId')
      .addSelect('p.id', 'playerId')
      .addSelect(`(SELECT COUNT(*) FROM game_questions WHERE game_id = g.id)`, 'questionsCount')
      .addSelect('COUNT(DISTINCT a.id)', 'answersCount')
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

      .leftJoin('g.players', 'p', 'p.user_id = :userId', { userId })
      .leftJoin('p.answers', 'a')

      .where('g.status = :status', { status: GameStatus.Active })
      .andWhere('p.user_id = :userId', { userId })

      .groupBy('g.id, p.id');

    return (await qb.getRawOne()) ?? null;
  }

  async saveGameQuestion(gameQuestion: GameQuestion): Promise<number> {
    const { id }: GameQuestion = await this.dataSource
      .getRepository<GameQuestion>(GameQuestion)
      .save(gameQuestion);

    return id;
  }

  async saveAnswer(answer: Answer): Promise<Answer> {
    return await this.dataSource.getRepository<Answer>(Answer).save(answer);
  }
}
