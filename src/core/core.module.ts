import { Global, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { CoreConfig } from './core.config';
import { TransactionHelper } from '../modules/database/trasaction.helper';

@Global()
@Module({
  imports: [CqrsModule],
  providers: [CoreConfig, TransactionHelper],
  exports: [CoreConfig, CqrsModule, TransactionHelper],
})
export class CoreModule {}
