import { ValidationError } from '@nestjs/common';
import { errorFormatter } from './error-formatter';
import { Extension } from '../domain-exceptions';

describe('errorFormatter', () => {
  it('should format flat errors with constrains', () => {
    const input: ValidationError[] = [
      {
        property: 'email',
        value: 'invalid-email',
        constraints: {
          isEmail: 'Email must be valid',
        },
        children: [],
      },
    ];

    const result: Extension[] = errorFormatter(input);

    expect(result).toEqual([
      {
        field: 'email',
        message: 'Email must be valid; Received value: invalid-email',
      },
    ]);
  });

  it('should handle nested validation errors', () => {
    const input: ValidationError[] = [
      {
        property: 'user',
        value: undefined,
        constraints: undefined,
        children: [
          {
            property: 'name',
            value: '',
            constraints: {
              isNotEmpty: 'Name should not be empty',
            },
            children: [],
          },
        ],
      },
    ];

    const result = errorFormatter(input);

    expect(result).toEqual([
      {
        field: 'name',
        message: 'Name should not be empty; Received value: ',
      },
    ]);
  });

  it('should return an empty array if no errors', () => {
    const result: Extension[] = errorFormatter([]);
    expect(result).toEqual([]);
  });

  it('should ignore errors without constraints or children', () => {
    const input: ValidationError[] = [
      {
        property: 'age',
        value: 42,
        constraints: undefined,
        children: [],
      },
    ];

    const result: Extension[] = errorFormatter(input);

    expect(result).toEqual([]);
  });
});
