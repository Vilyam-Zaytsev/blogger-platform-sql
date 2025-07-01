import { Controller } from '@nestjs/common';

@Controller('testing')
export class TestingController {
  // constructor(
  //   @InjectConnection() private readonly databaseConnection: Connection,
  // ) {}
  //
  // @Delete('all-data')
  // @HttpCode(HttpStatus.NO_CONTENT)
  // async deleteAll() {
  //   const collections = await this.databaseConnection.listCollections();
  //
  //   const promises = collections.map((collection) =>
  //     this.databaseConnection.collection(collection.name).deleteMany({}),
  //   );
  //   await Promise.all(promises);
  //
  //   return {
  //     status: 'succeeded',
  //   };
  // }
}
