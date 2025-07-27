/**
 * Утилитный класс для построения SQL-условий фильтрации с параметризацией.
 *
 * Предоставляет статические методы, которые формируют часть SQL-выражения `WHERE`
 * и соответствующий список значений для подстановки в параметризованные запросы (например, $1, $2 и т.д.).
 *
 * Каждый метод этого класса отвечает за генерацию фильтрационных условий для определённого набора полей —
 * например, по текстовому поиску, диапазонам значений, статусам и т.д.
 *
 * Возвращаемые значения включают:
 *  - строку условия, которую можно вставить в SQL-запрос;
 *  - массив значений, соответствующих параметрам в этом условии.
 *
 * Это помогает централизованно и безопасно формировать фильтры для SQL-запросов, избегая дублирования логики
 * и снижая риск SQL-инъекций.
 *
 * Класс проектируется как расширяемый: со временем может включать методы фильтрации для разных типов данных
 * и бизнес-сценариев.
 */
export class SearchFilterBuilder {
  static buildUserSearchFilter(
    searchLoginTerm: string | null,
    searchEmailTerm: string | null,
    startIndex = 1,
  ): { condition: string; values: string[] } {
    const filters: string[] = [];
    const values: string[] = [];
    let index: number = startIndex;

    if (searchLoginTerm) {
      filters.push(`login ILIKE '%' || $${index} || '%'`);
      values.push(searchLoginTerm);
      index++;
    }

    if (searchEmailTerm) {
      filters.push(`email ILIKE '%' || $${index} || '%'`);
      values.push(searchEmailTerm);
      index++;
    }

    const condition: string = filters.length > 0 ? filters.join(' OR ') : '';
    return { condition, values };
  }
}
