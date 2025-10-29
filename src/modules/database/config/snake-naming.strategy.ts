import { DefaultNamingStrategy, NamingStrategyInterface } from 'typeorm';
import { snakeCase } from 'typeorm/util/StringUtils';

/**
 * Стратегия именования для TypeORM
 * Конвертирует camelCase из TypeScript в snake_case для PostgreSQL
 *
 * Пример:
 * - TypeScript: @Column() firstPlayerScore: number
 * - PostgreSQL: first_player_score INTEGER
 */
export class SnakeNamingStrategy extends DefaultNamingStrategy implements NamingStrategyInterface {
  /**
   * Имена таблиц в БД
   * Game → game
   */
  tableName(className: string, customName: string): string {
    return customName ? customName : snakeCase(className);
  }

  /**
   * Имена столбцов в БД
   * firstPlayerScore → first_player_score
   */
  columnName(propertyName: string, customName: string, embeddedPrefixes: string[]): string {
    return (
      snakeCase(embeddedPrefixes.join('_')) + (customName ? customName : snakeCase(propertyName))
    );
  }

  /**
   * Имена отношений (для миграций)
   */
  relationName(propertyName: string): string {
    return snakeCase(propertyName);
  }

  /**
   * Имена JOIN столбцов для @ManyToOne/@OneToMany
   * gameQuestions → game_questions_id
   */
  joinColumnName(relationName: string, referencedColumnName: string): string {
    return snakeCase(relationName + '_' + referencedColumnName);
  }

  /**
   * Имена JOIN таблиц для @ManyToMany
   */
  joinTableName(
    firstTableName: string,
    secondTableName: string,
    firstPropertyName: string,
    secondPropertyName: string,
  ): string {
    return snakeCase(firstTableName + '_' + secondTableName);
  }

  /**
   * Имена JOIN столбцов в many-to-many таблице
   */
  joinTableColumnName(tableName: string, propertyName: string, columnName?: string): string {
    return snakeCase(tableName + '_' + (columnName ? columnName : propertyName));
  }

  /**
   * Имена обратных JOIN столбцов в many-to-many таблице
   */
  joinTableInverseColumnName(tableName: string, propertyName: string, columnName?: string): string {
    return snakeCase(tableName + '_' + (columnName ? columnName : propertyName));
  }

  /**
   * Имена столбцов для embeddable entities
   */
  embeddedColumnName(embeddedName: string, propertyName: string): string {
    return snakeCase(embeddedName + '_' + propertyName);
  }
}
