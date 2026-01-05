import { INestApplication, ValidationPipe } from '@nestjs/common';
import { SwaggerSettings } from './configuration/swagger-settings';
import { EnvironmentSettings } from './configuration/environment-settings';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { COOKIE_REFRESH_TOKEN_NAME } from '../constants/cookie-options.constants';
import { USER_AUTH_JWT_SCHEMA_NAME } from '../constants/auth-jwt-schema.constants';
import { errorFormatter } from '../core/exceptions/utils/error-formatter';
import { ValidationException } from '../core/exceptions/validation-exception';
import { Extension } from '../core/exceptions/domain-exceptions';
import { AllHttpExceptionsFilter } from '../core/exceptions/filters/all-exceptions.filter';
import { Configuration } from './configuration/configuration';
import { ApiSettings } from './configuration/api-settings';
import cookieParser from 'cookie-parser';
import expressBasicAuth from 'express-basic-auth';
import { ValidationExceptionFilter } from '../core/exceptions/filters/validation-exception.filter';
import { DomainHttpExceptionsFilter } from '../core/exceptions/filters/domain-exceptions.filter';
import { GLOBAL_PREFIX } from '../constants/global-prefix.constants';

const setupSwagger = (
  app: INestApplication,
  swaggerSettings: SwaggerSettings,
  environmentSettings: EnvironmentSettings,
): void => {
  const { SWAGGER_USER, SWAGGER_PASSWORD, SWAGGER_PATH } = swaggerSettings;

  if (!environmentSettings.isDevelopment) {
    app.use(
      `/${SWAGGER_PATH}`,
      expressBasicAuth({
        challenge: true,
        users: { [SWAGGER_USER]: SWAGGER_PASSWORD },
      }),
    );
  }

  const config: DocumentBuilder = new DocumentBuilder()
    .setTitle('Blogger Platform API')
    .setVersion('1.0.0')
    .setDescription('REST API для платформы блогов')
    .addCookieAuth(COOKIE_REFRESH_TOKEN_NAME, {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'Refresh Token хранится в httpOnly cookie',
    })
    .addBearerAuth(
      {
        bearerFormat: 'JWT',
        scheme: 'bearer',
        type: 'http',
        description: 'Access Token для обычных пользователей. Отправляется в Authorization header',
      },
      USER_AUTH_JWT_SCHEMA_NAME,
    )
    .addBasicAuth({ type: 'http', scheme: 'basic' }, 'basic');

  swaggerSettings.getSwaggerServers().forEach((server) => {
    config.addServer(server.url, server.description);
  });

  const document: OpenAPIObject = SwaggerModule.createDocument(app, config.build());
  SwaggerModule.setup(SWAGGER_PATH, app, document);
};

const setupValidationPipe = (app: INestApplication): void => {
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      stopAtFirstError: false,
      exceptionFactory: (errors) => {
        const formattedErrors: Extension[] = errorFormatter(errors);

        throw new ValidationException(formattedErrors);
      },
    }),
  );
};

const setupExceptionFilters = (
  app: INestApplication,
  isSendInternalServerErrorDetails: boolean,
): void => {
  app.useGlobalFilters(new AllHttpExceptionsFilter(isSendInternalServerErrorDetails));
  app.useGlobalFilters(new DomainHttpExceptionsFilter());
  app.useGlobalFilters(new ValidationExceptionFilter());
};

export const applyAppInitialization = (app: INestApplication): void => {
  const configuration: Configuration = app.get(Configuration);
  const apiSettings: ApiSettings = configuration.apiSettings;
  const swaggerSettings: SwaggerSettings = configuration.swaggerSettings;
  const environmentSettings: EnvironmentSettings = configuration.environmentSettings;

  app.setGlobalPrefix(GLOBAL_PREFIX);

  app.use(cookieParser());
  app.enableCors();

  setupSwagger(app, swaggerSettings, environmentSettings);

  setupValidationPipe(app);

  setupExceptionFilters(app, apiSettings.SEND_INTERNAL_SERVER_ERROR_DETAILS);

  if (environmentSettings.isDevelopment) {
    console.log('🚀 Development mode enabled');
    console.log(
      `📚 Swagger available at: http://localhost:${apiSettings.PORT}/${swaggerSettings.SWAGGER_PATH}`,
    );
  }
};
