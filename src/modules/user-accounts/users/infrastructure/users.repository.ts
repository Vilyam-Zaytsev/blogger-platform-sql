import { Injectable } from '@nestjs/common';
import { User } from '../domain/entities/user.entity';
import { DataSource } from 'typeorm';
import { BaseRepository } from '../../../../core/repositories/base.repository';

@Injectable()
export class UsersRepository extends BaseRepository<User> {
  constructor(dataSource: DataSource) {
    super(dataSource, User);
  }
  async getByLogin(login: string): Promise<User | null> {
    return await this.repository.findOneBy({ login });
  }

  async getByEmail(email: string): Promise<User | null> {
    return await this.repository.findOneBy({ email });
  }

  async getByEmailWithEmailConfirmationCode(email: string): Promise<User | null> {
    return await this.repository.findOne({
      relations: {
        emailConfirmationCode: true,
      },
      where: { email },
    });
  }

  async getByEmailWithPasswordRecoveryCode(email: string): Promise<User | null> {
    return await this.repository.findOne({
      relations: {
        passwordRecoveryCode: true,
      },
      where: { email },
    });
  }

  async getByEmailConfirmationCode(confirmationCode: string): Promise<User | null> {
    return await this.repository.findOne({
      relations: {
        emailConfirmationCode: true,
      },
      where: { emailConfirmationCode: { confirmationCode } },
    });
  }

  async getByPasswordRecoveryCode(recoveryCode: string): Promise<User | null> {
    return await this.repository.findOne({
      relations: {
        passwordRecoveryCode: true,
      },
      where: { passwordRecoveryCode: { recoveryCode } },
    });
  }
}
