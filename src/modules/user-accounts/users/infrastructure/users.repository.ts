import { Injectable } from '@nestjs/common';
import { User } from '../domain/entities/user.entity';
import { BaseRepository } from '../../../../core/repositories/base.repository';
import { TransactionHelper } from '../../../database/trasaction.helper';

@Injectable()
export class UsersRepository extends BaseRepository<User> {
  constructor(protected readonly transactionHelper: TransactionHelper) {
    super(User, transactionHelper);
  }
  async getByLogin(login: string): Promise<User | null> {
    return await this.getRepository().findOneBy({ login });
  }

  async getByEmail(email: string): Promise<User | null> {
    return await this.getRepository().findOneBy({ email });
  }

  async getByEmailWithEmailConfirmationCode(email: string): Promise<User | null> {
    return await this.getRepository().findOne({
      relations: {
        emailConfirmationCode: true,
      },
      where: { email },
    });
  }

  async getByEmailWithPasswordRecoveryCode(email: string): Promise<User | null> {
    return await this.getRepository().findOne({
      relations: {
        passwordRecoveryCode: true,
      },
      where: { email },
    });
  }

  async getByEmailConfirmationCode(confirmationCode: string): Promise<User | null> {
    return await this.getRepository().findOne({
      relations: {
        emailConfirmationCode: true,
      },
      where: { emailConfirmationCode: { confirmationCode } },
    });
  }

  async getByPasswordRecoveryCode(recoveryCode: string): Promise<User | null> {
    return await this.getRepository().findOne({
      relations: {
        passwordRecoveryCode: true,
      },
      where: { passwordRecoveryCode: { recoveryCode } },
    });
  }
}
