/**
 * Парсер заголовка базовой аутентификации для извлечения учётных данных администратора.
 *
 * Функция обрабатывает заголовок в формате "Basic base64(имя_пользователя:пароль)".
 * Она проверяет корректность формата, декодирует строку base64 и разделяет её на имя пользователя и пароль.
 *
 * @param {string} [authHeader] - Значение HTTP-заголовка "Authorization".
 *                               Параметр опциональный, но должен быть предоставлен для корректной работы.
 * @returns {[string, string]} Массив из двух элементов, содержащий имя пользователя и пароль.
 *
 * @throws {Error} Выбрасывает ошибку в следующих случаях:
 *                - заголовок отсутствует или имеет неверный формат;
 *                - строка не может быть декодирована из base64;
 *                - формат учётных данных не соответствует ожидаемому.
 */
export function parseAdminBasicAuth(authHeader?: string): [string, string] {
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    console.error(
      'Ошибка: Неверный формат заголовка базовой аутентификации. Ожидается формат "Basic base64(username:password)"',
    );
    throw new Error('Invalid Basic Authorization header format');
  }

  const base64Credentials: string = authHeader.split(' ')[1];

  let decoded: string;

  try {
    decoded = Buffer.from(base64Credentials, 'base64').toString('utf-8');
  } catch {
    console.error(
      'Ошибка: Не удалось декодировать учётные данные из формата base64',
    );
    throw new Error('Failed to decode Basic Auth credentials');
  }

  const [username, password] = decoded.split(':');

  if (!username || !password) {
    console.error(
      'Ошибка: Неверный формат учётных данных. Ожидается разделение username и password символом ":"',
    );
    throw new Error('Invalid Basic Auth credentials format');
  }

  return [username, password];
}
