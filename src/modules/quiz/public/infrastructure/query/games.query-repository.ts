import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { GameViewDto } from '../../api/view-dto/game.view-dto';
import { Game, GameStatus } from '../../domain/entities/game.entity';
import { GameRole } from '../../domain/entities/player.entity';
import { RawGame } from './types/raw-game.type';
import { DomainException } from '../../../../../core/exceptions/domain-exceptions';
import { DomainExceptionCode } from '../../../../../core/exceptions/domain-exception-codes';
import { GetGamesQueryParams } from '../../api/input-dto/get-games-query-params.input-dto';
import { PaginatedViewDto } from '../../../../../core/dto/paginated.view-dto';
import { convertToSnakeCase } from '../../../../../core/utils/convert-to-snake-case.utility';
import { StatisticViewDto } from '../../api/view-dto/statistic.view-dto';
import { RawStatistic } from './types/raw-statistic.type';
import { GetTopPlayersQueryParams } from '../../api/input-dto/get-top-players-query-params.input-dto';
import { TopGamePlayerViewDto } from '../../api/view-dto/top-game-player-view.dto';
import { RawTopPlayer } from './types/raw-top-players.type';

@Injectable()
export class GamesQueryRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async getByIdOrNotFoundFail(id: number): Promise<GameViewDto> {
    const qb = this.dataSource
      .getRepository<Game>(Game)
      .createQueryBuilder('g')

      // Игра
      .select('g.id', 'id')
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

      .where(`g.id = :id`, { id })

      .groupBy('g.id')
      .addGroupBy('p1.id')
      .addGroupBy('u1.id')
      .addGroupBy('p2.id')
      .addGroupBy('u2.id');

    const rawGame: RawGame | null = (await qb.getRawOne()) ?? null;

    if (!rawGame) {
      throw new DomainException({
        code: DomainExceptionCode.NotFound,
        message: `The game with ID (${id}) does not exist`,
      });
    }
    return GameViewDto.mapToView(rawGame);
  }

  async getAllGamesForUser(
    queryParams: GetGamesQueryParams,
    userId: number,
  ): Promise<PaginatedViewDto<GameViewDto>> {
    const { sortBy, sortDirection, pageSize, pageNumber }: GetGamesQueryParams = queryParams;
    const skip: number = queryParams.calculateSkip();
    const orderByColumn: string = convertToSnakeCase(sortBy);

    const qb = this.dataSource
      .getRepository<Game>(Game)
      .createQueryBuilder('g')

      .select([
        'g.id AS id',
        'g.created_at AS "pairCreatedDate"',
        'g.start_game_date AS "startGameDate"',
        'g.finish_game_date AS "finishGameDate"',
        'g.status AS "status"',
      ])

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
              ), '[]'
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
              ), '[]'
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

      .addSelect(
        `(
          SELECT COALESCE(
            json_agg(
              json_build_object(
                'id', q_gq.public_id,
                'body', q_gq.body
              ) ORDER BY gq_sub.order ASC
            ), '[]'
          )
          FROM game_questions gq_sub
          LEFT JOIN questions q_gq ON q_gq.id = gq_sub.question_id
          WHERE gq_sub.game_id = g.id
        )`,
        'questions',
      )

      .leftJoin('players', 'p1', 'p1.game_id = g.id AND p1.role = :hostRole', {
        hostRole: GameRole.Host,
      })
      .leftJoin('users', 'u1', 'u1.id = p1.user_id')

      .leftJoin('players', 'p2', 'p2.game_id = g.id AND p2.role = :playerRole', {
        playerRole: GameRole.Player,
      })
      .leftJoin('users', 'u2', 'u2.id = p2.user_id')

      .where('(p1.user_id = :userId OR p2.user_id = :userId)', { userId })

      .orderBy(`g.${orderByColumn}`, sortDirection.toUpperCase() as 'ASC' | 'DESC');

    if (orderByColumn !== 'created_at') {
      qb.addOrderBy('g.created_at', 'DESC');
    }

    qb.offset(skip)
      .limit(pageSize)

      .groupBy('g.id')
      .addGroupBy('p1.id')
      .addGroupBy('u1.id')
      .addGroupBy('p2.id')
      .addGroupBy('u2.id');

    const rawGames: RawGame[] = await qb.getRawMany();
    const totalCount: number = await qb.getCount();
    const pagesCount: number = Math.ceil(totalCount / pageSize);

    return {
      pagesCount,
      page: pageNumber,
      pageSize,
      totalCount,
      items: rawGames.map((g) => GameViewDto.mapToView(g)),
    };
  }

  async getMyStatisticByUserId(userId: number): Promise<StatisticViewDto> {
    const qb = this.dataSource
      .getRepository<Game>(Game)
      .createQueryBuilder('g')

      .select('COALESCE(SUM(currentPlayer.score), 0)', 'sumScore')
      .addSelect('COALESCE(ROUND(AVG(currentPlayer.score), 2), 0)', 'avgScores')
      .addSelect('COUNT(*)', 'gamesCount')
      .addSelect(
        'COALESCE(SUM(CASE WHEN currentPlayer.score > opponent.score THEN 1 ELSE 0 END), 0)',
        'winsCount',
      )
      .addSelect(
        'COALESCE(SUM(CASE WHEN currentPlayer.score < opponent.score THEN 1 ELSE 0 END), 0)',
        'lossesCount',
      )
      .addSelect(
        'COALESCE(SUM(CASE WHEN currentPlayer.score = opponent.score THEN 1 ELSE 0 END), 0)',
        'drawsCount',
      )

      .innerJoin(
        'players',
        'currentPlayer',
        'currentPlayer.game_id = g.id AND currentPlayer.user_id = :userId',
        { userId },
      )
      .innerJoin('players', 'opponent', 'opponent.game_id = g.id AND opponent.user_id != :userId', {
        userId,
      })

      .where(`g.status = '${GameStatus.Finished}'`);

    const rawStatistic: RawStatistic | null = (await qb.getRawOne()) ?? null;

    if (!rawStatistic) {
      return new StatisticViewDto();
    }

    return StatisticViewDto.mapToView(rawStatistic);
  }

  async getTopPlayers(
    queryParams: GetTopPlayersQueryParams,
  ): Promise<PaginatedViewDto<TopGamePlayerViewDto>> {
    const { pageSize, pageNumber }: GetTopPlayersQueryParams = queryParams;
    const skip: number = queryParams.calculateSkip();
    const sortFields: Array<{ field: string; direction: 'ASC' | 'DESC' }> =
      queryParams.getParsedSort();

    const qb = this.dataSource
      .createQueryBuilder()

      .select('u.id', 'userId')
      .addSelect('u.login', 'userLogin')
      .addSelect('COALESCE(SUM(p.score), 0)', 'sumScore')
      .addSelect('COALESCE(ROUND(AVG(p.score), 2), 0)', 'avgScores')
      .addSelect('COUNT(*)', 'gamesCount')
      .addSelect('SUM(CASE WHEN p.score > opponent.score THEN 1 ELSE 0 END)', 'winsCount')
      .addSelect('SUM(CASE WHEN p.score < opponent.score THEN 1 ELSE 0 END)', 'lossesCount')
      .addSelect('SUM(CASE WHEN p.score = opponent.score THEN 1 ELSE 0 END)', 'drawsCount')

      .from('players', 'p')
      .innerJoin('users', 'u', 'u.id = p.user_id')
      .innerJoin('games', 'g', 'g.id = p.game_id')
      .innerJoin('players', 'opponent', 'opponent.game_id = g.id AND opponent.user_id != p.user_id')

      .where('g.status = :status', { status: GameStatus.Finished })

      .groupBy('u.id')
      .addGroupBy('u.login');

    sortFields.forEach((sort, index) => {
      if (index === 0) {
        qb.orderBy(`"${sort.field}"`, sort.direction);
      } else {
        qb.addOrderBy(`"${sort.field}"`, sort.direction);
      }
    });

    qb.offset(skip).limit(pageSize);

    const rawTopPlayers: RawTopPlayer[] = await qb.getRawMany();

    const countQb = this.dataSource
      .createQueryBuilder()
      .select('COUNT(DISTINCT u.id)', 'count')
      .from('players', 'p')
      .innerJoin('users', 'u', 'u.id = p.user_id')
      .innerJoin('games', 'g', 'g.id = p.game_id')
      .innerJoin('players', 'opponent', 'opponent.game_id = g.id AND opponent.user_id != p.user_id')
      .where('g.status = :status', { status: GameStatus.Finished });

    const countResult: { count: string } | undefined = await countQb.getRawOne();
    const totalCount: number = countResult ? +countResult.count : 0;
    const pagesCount: number = Math.ceil(totalCount / pageSize);

    return {
      pagesCount,
      page: pageNumber,
      pageSize,
      totalCount,
      items: rawTopPlayers.map((t) => TopGamePlayerViewDto.mapToView(t)),
    };
  }
}
