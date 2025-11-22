import { validate, ValidationError } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { IsStringArrayWithLength } from './is-string-array-with-length.decorator';

/**
 * Тестовый класс для проверки декоратора IsStringArrayWithLength
 * Используется для создания объектов с валидируемыми свойствами
 */
class TestDto {
  @IsStringArrayWithLength(2, 10)
  validatedArray: any;
}

/**
 * Тестовый класс с кастомным сообщением об ошибке
 */
class TestDtoWithCustomMessage {
  @IsStringArrayWithLength(3, 5, {
    message: 'Custom error message for array validation',
  })
  customMessageArray: any;
}

/**
 * Тестовый класс для проверки множественных декораторов
 */
class TestDtoMultipleFields {
  @IsStringArrayWithLength(1, 5)
  shortStrings: any;

  @IsStringArrayWithLength(10, 20)
  longStrings: any;
}

describe('IsStringArrayWithLength Decorator', () => {
  describe('Валидные случаи (должны проходить валидацию)', () => {
    it('должен пройти валидацию для корректного массива строк', async () => {
      const testObj: TestDto = plainToClass(TestDto, {
        validatedArray: ['ab', 'test', 'hello'],
      });

      const errors: ValidationError[] = await validate(testObj);

      expect(errors).toHaveLength(0);
    });

    it('должен пройти валидацию для строк минимальной длины', async () => {
      const testObj: TestDto = plainToClass(TestDto, {
        validatedArray: ['ab', 'cd', 'ef'],
      });

      const errors: ValidationError[] = await validate(testObj);

      expect(errors).toHaveLength(0);
    });

    it('должен пройти валидацию для строк максимальной длины', async () => {
      const testObj: TestDto = plainToClass(TestDto, {
        validatedArray: ['1234567890', 'abcdefghij'],
      });

      const errors: ValidationError[] = await validate(testObj);

      expect(errors).toHaveLength(0);
    });

    it('должен пройти валидацию для пустого массива', async () => {
      const testObj: TestDto = plainToClass(TestDto, {
        validatedArray: [],
      });

      const errors: ValidationError[] = await validate(testObj);

      expect(errors).toHaveLength(0);
    });

    it('должен пройти валидацию для массива с одной корректной строкой', async () => {
      const testObj: TestDto = plainToClass(TestDto, {
        validatedArray: ['valid'],
      });

      const errors: ValidationError[] = await validate(testObj);

      expect(errors).toHaveLength(0);
    });
  });

  describe('Невалидные случаи (должны провалить валидацию)', () => {
    it('должен провалить валидацию для не-массива', async () => {
      const testObj: TestDto = plainToClass(TestDto, {
        validatedArray: 'not an array',
      });

      const errors: ValidationError[] = await validate(testObj);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('validatedArray');
      expect(errors[0].constraints?.isStringArrayWithLength).toBe(
        'validatedArray must be an array of strings with length between 2 and 10 characters',
      );
    });

    it('должен провалить валидацию для null', async () => {
      const testObj: TestDto = plainToClass(TestDto, {
        validatedArray: null,
      });

      const errors: ValidationError[] = await validate(testObj);

      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.isStringArrayWithLength).toBe(
        'validatedArray must be an array of strings with length between 2 and 10 characters',
      );
    });

    it('должен провалить валидацию для undefined', async () => {
      const testObj: TestDto = plainToClass(TestDto, {
        validatedArray: undefined,
      });

      const errors: ValidationError[] = await validate(testObj);

      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.isStringArrayWithLength).toBe(
        'validatedArray must be an array of strings with length between 2 and 10 characters',
      );
    });

    it('должен провалить валидацию для массива с элементами не-строками', async () => {
      const testObj: TestDto = plainToClass(TestDto, {
        validatedArray: [123, 456, 'string'],
      });

      const errors: ValidationError[] = await validate(testObj);

      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.isStringArrayWithLength).toBe(
        'validatedArray must be an array of strings with length between 2 and 10 characters',
      );
    });

    it('должен провалить валидацию для массива с объектами', async () => {
      const testObj: TestDto = plainToClass(TestDto, {
        validatedArray: [{ key: 'value' }, { another: 'object' }],
      });

      const errors: ValidationError[] = await validate(testObj);

      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.isStringArrayWithLength).toBe(
        'validatedArray must be an array of strings with length between 2 and 10 characters',
      );
    });

    it('должен провалить валидацию для строк короче минимальной длины', async () => {
      const testObj: TestDto = plainToClass(TestDto, {
        validatedArray: ['a', 'b', 'c'],
      });

      const errors: ValidationError[] = await validate(testObj);

      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.isStringArrayWithLength).toBe(
        'validatedArray must be an array of strings with length between 2 and 10 characters',
      );
    });

    it('должен провалить валидацию для строк длиннее максимальной длины', async () => {
      const testObj: TestDto = plainToClass(TestDto, {
        validatedArray: ['this is too long', 'another long string'],
      });

      const errors: ValidationError[] = await validate(testObj);

      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.isStringArrayWithLength).toBe(
        'validatedArray must be an array of strings with length between 2 and 10 characters',
      );
    });

    it('должен провалить валидацию если хотя бы одна строка не соответствует критериям', async () => {
      const testObj: TestDto = plainToClass(TestDto, {
        validatedArray: ['valid', 'good', 'a'],
      });

      const errors: ValidationError[] = await validate(testObj);

      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.isStringArrayWithLength).toBe(
        'validatedArray must be an array of strings with length between 2 and 10 characters',
      );
    });

    it('должен провалить валидацию для смешанного массива (строки + другие типы)', async () => {
      const testObj: TestDto = plainToClass(TestDto, {
        validatedArray: ['valid', 123, 'another', true, null],
      });

      const errors: ValidationError[] = await validate(testObj);

      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.isStringArrayWithLength).toBe(
        'validatedArray must be an array of strings with length between 2 and 10 characters',
      );
    });

    it('должен провалить валидацию для массива с пустыми строками', async () => {
      const testObj: TestDto = plainToClass(TestDto, {
        validatedArray: ['', '', ''],
      });

      const errors: ValidationError[] = await validate(testObj);

      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.isStringArrayWithLength).toBe(
        'validatedArray must be an array of strings with length between 2 and 10 characters',
      );
    });
  });

  describe('Кастомные сообщения об ошибках', () => {
    it('должен использовать кастомное сообщение об ошибке когда оно задано', async () => {
      const testObj: TestDtoWithCustomMessage = plainToClass(TestDtoWithCustomMessage, {
        customMessageArray: ['invalid'],
      });

      const errors: ValidationError[] = await validate(testObj);

      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.isStringArrayWithLength).toBe(
        'Custom error message for array validation',
      );
    });

    it('должен использовать дефолтное сообщение когда кастомное не задано', async () => {
      const testObj: TestDto = plainToClass(TestDto, {
        validatedArray: 'not array',
      });

      const errors: ValidationError[] = await validate(testObj);

      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.isStringArrayWithLength).toBe(
        'validatedArray must be an array of strings with length between 2 and 10 characters',
      );
    });
  });

  describe('Множественные поля с разными ограничениями', () => {
    it('должен валидировать несколько полей независимо', async () => {
      const testObj: TestDtoMultipleFields = plainToClass(TestDtoMultipleFields, {
        shortStrings: ['a'],
        longStrings: ['1234567890'],
      });

      const errors: ValidationError[] = await validate(testObj);

      expect(errors).toHaveLength(0);
    });

    it('должен отдельно сообщать об ошибках в каждом поле', async () => {
      const testObj: TestDtoMultipleFields = plainToClass(TestDtoMultipleFields, {
        shortStrings: ['this is too long for short strings field'],
        longStrings: ['short'],
      });

      const errors: ValidationError[] = await validate(testObj);

      expect(errors).toHaveLength(2);

      const shortStringsError: ValidationError | undefined = errors.find(
        (err) => err.property === 'shortStrings',
      );
      const longStringsError: ValidationError | undefined = errors.find(
        (err) => err.property === 'longStrings',
      );

      expect(shortStringsError).toBeDefined();
      expect(longStringsError).toBeDefined();

      expect(shortStringsError!.constraints?.isStringArrayWithLength).toBe(
        'shortStrings must be an array of strings with length between 1 and 5 characters',
      );
      expect(longStringsError!.constraints?.isStringArrayWithLength).toBe(
        'longStrings must be an array of strings with length between 10 and 20 characters',
      );
    });
  });

  describe('Edge cases и специальные сценарии', () => {
    it('должен провалить валидацию для строк из пробелов (после trim становятся пустыми)', async () => {
      const testObj: TestDto = plainToClass(TestDto, {
        validatedArray: ['  ', '   ', '    '],
      });

      const errors: ValidationError[] = await validate(testObj);

      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.isStringArrayWithLength).toBe(
        'validatedArray must be an array of strings with length between 2 and 10 characters',
      );
    });

    it('должен пройти валидацию для строк с пробелами по краям если trimmed длина валидна', async () => {
      const testObj: TestDto = plainToClass(TestDto, {
        validatedArray: ['  hello  ', '   world   ', '\ttestAB\t'],
      });

      const errors: ValidationError[] = await validate(testObj);

      expect(errors).toHaveLength(0);
    });

    it('должен провалить валидацию если trimmed строка слишком короткая', async () => {
      const testObj: TestDto = plainToClass(TestDto, {
        validatedArray: ['  a  ', '   valid   '],
      });

      const errors: ValidationError[] = await validate(testObj);

      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.isStringArrayWithLength).toBe(
        'validatedArray must be an array of strings with length between 2 and 10 characters',
      );
    });

    it('должен провалить валидацию если trimmed строка слишком длинная', async () => {
      const testObj: TestDto = plainToClass(TestDto, {
        validatedArray: ['  this-is-very-long  ', '   ok   '],
      });

      const errors: ValidationError[] = await validate(testObj);

      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.isStringArrayWithLength).toBe(
        'validatedArray must be an array of strings with length between 2 and 10 characters',
      );
    });

    it('должен провалить валидацию для строк из разных whitespace символов', async () => {
      const testObj: TestDto = plainToClass(TestDto, {
        validatedArray: [
          '   ', // spaces
          '\t\t', // tabs
          '\n', // newline
          '\r\n', // carriage return + newline
          ' \t\n ', // mixed whitespace
        ], // все после trim() -> '' (длина 0)
      });

      const errors: ValidationError[] = await validate(testObj);

      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.isStringArrayWithLength).toBe(
        'validatedArray must be an array of strings with length between 2 and 10 characters',
      );
    });

    it('должен корректно обрабатывать специальные символы', async () => {
      const testObj: TestDto = plainToClass(TestDto, {
        validatedArray: ['@#$%', '!?&*', '()[]{}'],
      });

      const errors: ValidationError[] = await validate(testObj);

      expect(errors).toHaveLength(0);
    });

    it('должен корректно обрабатывать Unicode символы', async () => {
      const testObj: TestDto = plainToClass(TestDto, {
        validatedArray: ['🎉🎊', 'тест', '测试'],
      });

      const errors: ValidationError[] = await validate(testObj);

      expect(errors).toHaveLength(0);
    });

    it('должен провалить валидацию для очень большого массива с невалидными данными', async () => {
      const invalidArray = Array(1000).fill('x');
      const testObj: TestDto = plainToClass(TestDto, {
        validatedArray: invalidArray,
      });

      const errors: ValidationError[] = await validate(testObj);

      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.isStringArrayWithLength).toBe(
        'validatedArray must be an array of strings with length between 2 and 10 characters',
      );
    });

    it('должен пройти валидацию для очень большого массива с валидными данными', async () => {
      const validArray = Array(1000).fill('valid');
      const testObj: TestDto = plainToClass(TestDto, {
        validatedArray: validArray,
      });

      const errors: ValidationError[] = await validate(testObj);

      expect(errors).toHaveLength(0);
    });
  });

  describe('Граничные значения minLength и maxLength', () => {
    it('должен корректно работать когда minLength равен 0', async () => {
      class TestDtoZeroMin {
        @IsStringArrayWithLength(0, 5)
        zeroMinArray: any;
      }

      const testObj: TestDtoZeroMin = plainToClass(TestDtoZeroMin, {
        zeroMinArray: ['', 'a', '   ', '\t', 'hello'],
      });

      const errors: ValidationError[] = await validate(testObj);

      expect(errors).toHaveLength(0);
    });

    it('должен корректно работать когда minLength равен maxLength', async () => {
      class TestDtoEqualLengths {
        @IsStringArrayWithLength(5, 5)
        exactLengthArray: any;
      }

      const testObj: TestDtoEqualLengths = plainToClass(TestDtoEqualLengths, {
        exactLengthArray: ['hello', 'world'],
      });

      const errors: ValidationError[] = await validate(testObj);

      expect(errors).toHaveLength(0);
    });

    it('должен корректно работать когда minLength равен maxLength с учетом trim', async () => {
      class TestDtoEqualLengths {
        @IsStringArrayWithLength(5, 5)
        exactLengthArray: any;
      }

      const testObj: TestDtoEqualLengths = plainToClass(TestDtoEqualLengths, {
        exactLengthArray: ['  hello  ', '  world '],
      });

      const errors: ValidationError[] = await validate(testObj);

      expect(errors).toHaveLength(0);
    });

    it('должен провалить валидацию когда строка не точно равна требуемой длине', async () => {
      class TestDtoEqualLengths {
        @IsStringArrayWithLength(5, 5)
        exactLengthArray: any;
      }

      const testObj: TestDtoEqualLengths = plainToClass(TestDtoEqualLengths, {
        exactLengthArray: ['hell', 'world!'],
      });

      const errors: ValidationError[] = await validate(testObj);

      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.isStringArrayWithLength).toBe(
        'exactLengthArray must be an array of strings with length between 5 and 5 characters',
      );
    });

    it('должен провалить валидацию когда trimmed строка не равна требуемой длине', async () => {
      class TestDtoEqualLengths {
        @IsStringArrayWithLength(5, 5)
        exactLengthArray: any;
      }

      const testObj: TestDtoEqualLengths = plainToClass(TestDtoEqualLengths, {
        exactLengthArray: [' hell ', ' world! '],
      });

      const errors: ValidationError[] = await validate(testObj);

      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.isStringArrayWithLength).toBe(
        'exactLengthArray must be an array of strings with length between 5 and 5 characters',
      );
    });

    it('должен корректно работать с граничными значениями после trim', async () => {
      const testObj: TestDto = plainToClass(TestDto, {
        validatedArray: ['  ab', 'cd   ', ' 1234567890 '],
      });

      const errors: ValidationError[] = await validate(testObj);

      expect(errors).toHaveLength(0);
    });
  });
});
