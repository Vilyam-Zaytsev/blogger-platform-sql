import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm/dist/common/typeorm.decorators';
import { AsyncLocalStorage } from 'async_hooks';
import { DataSource, EntityManager } from 'typeorm';

/**
 * TransactionHelper: Управление транзакциями через AsyncLocalStorage
 *
 * 📌 НАЗНАЧЕНИЕ:
 * Позволяет выполнять несколько DB операций в одной транзакции,
 * без необходимости пробрасывать EntityManager через параметры функций.
 *
 * 📌 КАК РАБОТАЕТ:
 * 1. doTransactional() создаёт реальную БД транзакцию
 * 2. AsyncLocalStorage сохраняет текущий manager в "местное хранилище"
 * 3. Когда репозиторий вызывает getManager() → получает сохранённый manager
 * 4. Все операции используют ОДИН manager → ОДНА транзакция
 * 5. Если ошибка → откатываются ВСЕ операции
 *
 * 📌 АНАЛОГИЯ:
 * Как ThreadLocal в Java, но для асинхронного Node.js кода
 */
@Injectable()
export class TransactionHelper {
  /**
   * AsyncLocalStorage: "Волшебный карман" для контекста транзакции
   *
   * Каждый асинхронный вызов имеет свой изолированный карман.
   * Если запрос А создаст транзакцию → только запрос А её видит.
   * Если запрос Б создаст свою → они не пересекаются.
   */
  private readonly asyncLocalStorage: AsyncLocalStorage<Map<string, EntityManager>>;

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {
    this.asyncLocalStorage = new AsyncLocalStorage();
  }

  /**
   * 🎯 ПОЛУЧИТЬ ПРАВИЛЬНЫЙ ENTITYMANAGER
   *
   * Логика:
   *
   * Есть ли активная транзакция?
   *
   * ДА (находимся в doTransactional)
   *
   * └─→ asyncLocalStorage.getStore() вернёт Map
   *
   *     └─→ Map.get('typeOrmEntityManager') вернёт manager
   *
   *         └─→ Это ТРАНЗАКЦИОННЫЙ manager ✅
   *
   * НЕТ (обычный вызов вне doTransactional)
   *
   * └─→ asyncLocalStorage.getStore() вернёт undefined
   *
   *     └─→ Вернём dataSource.createEntityManager()
   *
   *         └─→ Это ОБЫЧНЫЙ manager (новый экземпляр)
   *
   * @returns EntityManager - либо транзакционный, либо обычный
   */
  getManager(): EntityManager {
    const storage = this.asyncLocalStorage.getStore();

    // Если мы внутри doTransactional → storage существует
    if (storage && storage.has('typeOrmEntityManager')) {
      return storage.get('typeOrmEntityManager')!;
    }

    // Если нет → создаём обычный manager (операция вне транзакции)
    return this.dataSource.createEntityManager();
  }

  /**
   * 🎯 ЗАПУСТИТЬ ФУНКЦИЮ В КОНТЕКСТЕ ТРАНЗАКЦИИ
   *
   * Процесс выполнения:
   *
   * 1. dataSource.transaction() создаёт реальную транзакцию
   *    (BEGIN в БД)
   *
   * 2. Получаем manager, связанный с этой транзакцией
   *
   * 3. asyncLocalStorage.run() создаёт изолированный контекст
   *    для этого конкретного вызова
   *
   * 4. Сохраняем manager в Map внутри asyncLocalStorage
   *    (потом getManager() его найдёт)
   *
   * 5. Выполняем пользовательскую функцию fn()
   *    - Все await-ы внутри fn() видят транзакцию
   *    - Все вложенные функции могут вызвать getManager()
   *    - Все они получат ОДИН и ТОТ ЖЕ manager
   *
   * 6. Если fn() успешна:
   *    - COMMIT транзакция (все данные в БД)
   *    - return результат fn()
   *
   * 7. Если fn() выбросит ошибку:
   *    - ROLLBACK всей транзакции
   *    - ошибка пройдёт дальше (обработается в контроллере)
   *
   * @param fn - асинхронная функция, которую выполнить в транзакции
   * @returns результат fn()
   *
   * @example
   * // Пример использования:
   * await transactionHelper.doTransactional(async () => {
   *   // Обе операции будут в одной транзакции
   *   const user = await userRepository.save(newUser);
   *   await accountRepository.save(newAccount);
   *   // Если accountRepository.save упадёт → userRepository.save откатится!
   * });
   */
  async doTransactional<T>(fn: () => Promise<T>): Promise<T> {
    // Создаём реальную БД транзакцию и получаем её manager
    return this.dataSource.transaction(async (transactionManager) => {
      // Запускаем функцию в изолированном контексте asyncLocalStorage
      return await this.asyncLocalStorage.run(
        new Map<string, EntityManager>(), // Новая Map для каждого вызова
        async () => {
          // Сохраняем manager в Map
          // Теперь getManager() найдёт его и вернёт
          this.asyncLocalStorage.getStore()!.set('typeOrmEntityManager', transactionManager);

          // Выполняем пользовательскую логику
          // Все await внутри fn используют наш transactionManager
          // Если fn вернула результат → возвращаем его
          // dataSource.transaction автоматически создаст COMMIT если не было ошибки
          return await fn();
        },
      );
    });
  }
}
