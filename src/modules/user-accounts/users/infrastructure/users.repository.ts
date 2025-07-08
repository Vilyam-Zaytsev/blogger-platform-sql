import { Injectable } from '@nestjs/common';

@Injectable()
export class UsersRepository {
  constructor() {}

  // async getByIdOrNotFoundFail(id: string): Promise<UserDocument> {
  //   const user: UserDocument | null = await this.UserModel.findOne({
  //     _id: id,
  //     deletedAt: null,
  //   });
  //
  //   if (!user) {
  //     throw new DomainException({
  //       code: DomainExceptionCode.NotFound,
  //       message: `The user with ID (${id}) does not exist`,
  //     });
  //   }
  //
  //   return user;
  // }
  //
  // async getByConfirmationCode(
  //   confirmationCode: string,
  // ): Promise<UserDocument | null> {
  //   return this.UserModel.findOne({
  //     'emailConfirmation.confirmationCode': confirmationCode,
  //     deletedAt: null,
  //   });
  // }
  //
  // async getByRecoveryCode(recoveryCode: string): Promise<UserDocument | null> {
  //   return this.UserModel.findOne({
  //     'passwordRecovery.recoveryCode': recoveryCode,
  //     deletedAt: null,
  //   });
  // }
  //
  // async getByLogin(login: string): Promise<UserDocument | null> {
  //   return this.UserModel.findOne({
  //     login,
  //     deletedAt: null,
  //   });
  // }
  //
  // async getByEmail(email: string): Promise<UserDocument | null> {
  //   return this.UserModel.findOne({
  //     email,
  //     deletedAt: null,
  //   });
  // }
  //
  // async getByIds(ids: string[]): Promise<UserDocument[]> {
  //   return this.UserModel.find({ _id: { $in: ids } });
  // }
  //
  // async save(user: UserDocument): Promise<string> {
  //   const resultSave: UserDocument = await user.save();
  //
  //   return resultSave._id.toString();
  // }
}
