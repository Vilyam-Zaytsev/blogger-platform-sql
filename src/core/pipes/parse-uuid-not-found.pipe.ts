import { Injectable, NotFoundException, ParseUUIDPipe } from '@nestjs/common';

@Injectable()
export class ParseUUIDPipeNotFound extends ParseUUIDPipe {
  constructor() {
    super({
      exceptionFactory: (error: string) => {
        throw new NotFoundException('Resource not found');
      },
    });
  }
}
