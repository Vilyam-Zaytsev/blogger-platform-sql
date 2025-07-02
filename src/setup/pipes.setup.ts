import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ValidationException } from '../core/exceptions/validation-exception';
import { errorFormatter } from '../core/exceptions/utils/error-formatter';

function pipesSetup(app: INestApplication) {
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      stopAtFirstError: true,
      exceptionFactory: (errors) => {
        const formattedErrors = errorFormatter(errors);

        throw new ValidationException(formattedErrors);
      },
    }),
  );
}

export { pipesSetup };
