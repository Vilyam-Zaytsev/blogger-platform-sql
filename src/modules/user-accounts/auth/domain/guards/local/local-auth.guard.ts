import { ExecutionContext, Injectable, ValidationError } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { LoginInputDto } from '../../../api/input-dto/login.input-dto';
import { errorFormatter } from '../../../../../../core/exceptions/utils/error-formatter';
import { ValidationException } from '../../../../../../core/exceptions/validation-exception';
import { Extension } from '../../../../../../core/exceptions/domain-exceptions';

@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    const dtoObject: LoginInputDto = plainToInstance(
      LoginInputDto,
      request.body,
    );

    const errors: ValidationError[] = validateSync(dtoObject, {
      whitelist: true,
      forbidNonWhitelisted: true,
      stopAtFirstError: true,
    });

    if (errors.length > 0) {
      const errorsForResponse: Extension[] = errorFormatter(errors);

      throw new ValidationException(errorsForResponse);
    }

    return super.canActivate(context) as boolean;
  }
}
