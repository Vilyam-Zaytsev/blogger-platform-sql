import { Module } from '@nestjs/common';
import { TestingController } from './testing.controller';
import { TestingService } from './testing.services';

@Module({
  imports: [],
  controllers: [TestingController],
  providers: [TestingService],
})
export class TestingModule {}
