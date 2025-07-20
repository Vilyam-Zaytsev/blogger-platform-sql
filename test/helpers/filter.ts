import { SortDirection } from '../../src/core/dto/base.query-params.input-dto';
import { TestSearchFilter } from '../types';

/**
 * Универсальный служебный класс для фильтрации, сортировки и пагинации массива объектов.
 *
 * Предназначен для работы с обычными JavaScript-объектами, включая поддержку вложенных полей.
 * Типичный случай использования — фильтрация и сортировка коллекций в памяти, например, тестовых данных или простых запросов.
 *
 * @template T Тип объектов в массиве
 */
export class Filter<T extends object> {
  private items: T[];
  private propertyMap: Partial<Record<keyof T, string>> = {};
  private skipCount: number = 0;
  private limitCount?: number;
  private sortBy?: keyof T;
  private sortDirection?: SortDirection;

  /**
   * Инициализирует новый экземпляр класса Filter.
   *
   * @param {T[]} items Массив элементов для применения фильтрации, сортировки и пагинации
   */
  constructor(items: T[]) {
    this.items = items;
  }

  /**
   * Рекурсивно создает карту имен полей с их полными путями в формате с разделителями точками.
   *
   * Используется для доступа к вложенным полям при сортировке.
   *
   * @param {T} obj Объект, из которого извлекаются пути свойств
   * @param {string} [prefix] Префикс пути для вложенных свойств
   */
  private createPropertyMap(obj: T, prefix?: string): void {
    for (const key in obj) {
      const value = obj[key];
      const path = prefix ? `${prefix}.${key}` : key;

      if (
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value)
      ) {
        this.createPropertyMap(value as unknown as T, path);
      } else {
        this.propertyMap[key as keyof T] = path;
      }
    }
  }

  /**
   * Получает значение из объекта по указанному пути с разделителями точками.
   *
   * @param {T} obj Объект для доступа
   * @param {string} path Путь к свойству в формате "profile.name"
   * @returns {unknown} Значение по указанному пути или undefined, если не найдено
   */
  private getValueByPath(obj: T, path: string): unknown {
    return path.split('.').reduce((acc: unknown, key) => {
      if (acc && typeof acc === 'object') {
        return (acc as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj);
  }

  /**
   * Сравнивает два значения в зависимости от указанного направления сортировки.
   *
   * @param {unknown} a Первое значение для сравнения
   * @param {unknown} b Второе значение для сравнения
   * @param {SortDirection} direction Направление сортировки (по возрастанию или убыванию)
   * @returns {number} Результат сравнения: -1, 0 или 1
   */
  private compareValues(
    a: unknown,
    b: unknown,
    direction: SortDirection,
  ): number {
    if (typeof a === 'string' && typeof b === 'string') {
      const comparison: number = a.localeCompare(b);
      return direction === SortDirection.Ascending ? comparison : -comparison;
    }
    if (typeof a === 'number' && typeof b === 'number') {
      if (a < b) return direction === SortDirection.Ascending ? -1 : 1;
      if (a > b) return direction === SortDirection.Ascending ? 1 : -1;
      return 0;
    }
    return 0;
  }

  /**
   * Устанавливает конфигурацию сортировки по указанному свойству и направлению.
   * Поддерживает сортировку по вложенным свойствам.
   *
   * @param {Partial<Record<keyof T, SortDirection>>} sortObj Объект конфигурации сортировки
   * @returns {this} Текущий экземпляр Filter для цепочечного вызова
   */
  sort(sortObj: Partial<Record<keyof T, SortDirection>>): this {
    const keys = Object.keys(sortObj) as (keyof T)[];
    if (keys.length === 0) return this;

    this.sortBy = keys[0];
    this.sortDirection = sortObj[this.sortBy];

    if (this.items.length > 0) {
      this.createPropertyMap(this.items[0]);
    }

    return this;
  }

  /**
   * Пропускает первые N элементов в результирующем наборе.
   *
   * @param {number} count Количество элементов для пропуска
   * @returns {this} Текущий экземпляр Filter для цепочечного вызова
   */
  skip(count: number): this {
    this.skipCount = count;
    return this;
  }

  /**
   * Ограничивает количество элементов в результирующем наборе.
   *
   * @param {number} count Максимальное количество возвращаемых элементов
   * @returns {this} Текущий экземпляр Filter для цепочечного вызова
   */
  limit(count: number): this {
    this.limitCount = count;
    return this;
  }

  /**
   * Фильтрует элементы на основе поискового фильтра.
   * В настоящее время поддерживает только частичное, нечувствительное к регистру сопоставление строк для полей верхнего уровня.
   *
   * @param {Partial<TestSearchFilter>} searchFilter Объект ключ-значение для фильтрации
   * @returns {this} Текущий экземпляр Filter для цепочечного вызова
   */
  filter(searchFilter: Partial<TestSearchFilter>): this {
    this.items = this.items.filter((item) => {
      let hasAtLeastOneMatch = false;

      for (const key in searchFilter) {
        const searchTerm: string | undefined =
          searchFilter[key as keyof TestSearchFilter];
        if (searchTerm == null || searchTerm === '') continue;

        const fieldName: string = key;

        if (!(fieldName in item)) {
          continue;
        }

        const itemValue = item[fieldName as keyof T];

        if (typeof itemValue !== 'string') continue;

        if (itemValue.toLowerCase().includes(searchTerm.toLowerCase()))
          hasAtLeastOneMatch = true;
      }
      return hasAtLeastOneMatch;
    });

    return this;
  }

  /**
   * Выполняет сортировку, пропуск, ограничение и возвращает итоговый массив.
   *
   * @returns {T[]} Обработанный и отфильтрованный массив элементов
   *
   * @throws {Error} Если указанное свойство sortBy недействительно
   */
  getResult(): T[] {
    let result: T[] = [...this.items];

    if (this.sortBy && this.sortDirection) {
      const path = this.propertyMap[this.sortBy];
      if (!path) {
        throw new Error(`Invalid sortBy property: ${String(this.sortBy)}`);
      }

      result = result.sort((a, b) => {
        const aValue = this.getValueByPath(a, path);
        const bValue = this.getValueByPath(b, path);
        return this.compareValues(aValue, bValue, this.sortDirection!);
      });
    }

    if (this.skipCount) {
      result = result.slice(this.skipCount);
    }

    if (this.limitCount !== undefined) {
      result = result.slice(0, this.limitCount);
    }

    return result;
  }
}
