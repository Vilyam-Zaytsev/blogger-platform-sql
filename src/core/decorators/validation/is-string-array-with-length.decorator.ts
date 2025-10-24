import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';

export function IsStringArrayWithLength(
  minLength: number,
  maxLength: number,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isStringArrayWithLength',
      target: object.constructor,
      propertyName,
      constraints: [minLength, maxLength],
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          if (!Array.isArray(value)) return false;

          const [min, max] = args.constraints as number[];
          return value.every(
            (item) =>
              typeof item === 'string' && item.trim().length >= min && item.trim().length <= max,
          );
        },
        defaultMessage(args: ValidationArguments) {
          const [min, max] = args.constraints as number[];

          return `${args.property} must be an array of strings with length between ${min} and ${max} characters`;
        },
      },
    });
  };
}
