import { Global, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TransactionHelper } from '../modules/database/trasaction.helper';

@Global()
@Module({
  imports: [CqrsModule],
  providers: [TransactionHelper],
  exports: [CqrsModule, TransactionHelper],
})
export class CoreModule {}
