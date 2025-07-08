import { Injectable } from '@nestjs/common';
import { CryptoService } from './crypto.service';
import { UsersRepository } from '../../infrastructure/users.repository';

@Injectable()
export class UserValidationService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly cryptoService: CryptoService,
  ) {}

  // async validateUniqueUser(dto: CreateUserDto): Promise<void> {
  //   const [byLogin, byEmail] = await Promise.all([
  //     this.usersRepository.getByLogin(dto.login),
  //     this.usersRepository.getByEmail(dto.email),
  //   ]);
  //
  //   if (byLogin) {
  //     throw new ValidationException([
  //       {
  //         message: 'User with the same login already exists.',
  //         field: 'login',
  //       },
  //     ]);
  //   }
  //
  //   if (byEmail) {
  //     throw new ValidationException([
  //       {
  //         message: 'User with the same email already exists.',
  //         field: 'email',
  //       },
  //     ]);
  //   }
  // }

  // async authenticateUser(
  //   loginOrEmail: string,
  //   password: string,
  // ): Promise<UserContextDto> {
  //   let user: UserDocument | null =
  //     await this.usersRepository.getByEmail(loginOrEmail);
  //
  //   if (!user) {
  //     user = await this.usersRepository.getByLogin(loginOrEmail);
  //   }
  //
  //   if (!user) {
  //     throw new DomainException({
  //       code: DomainExceptionCode.Unauthorized,
  //       message: 'Invalid username or password',
  //     });
  //   }
  //
  //   const isPasswordValid: boolean = await this.cryptoService.comparePassword({
  //     password,
  //     hash: user.passwordHash,
  //   });
  //
  //   if (!isPasswordValid) {
  //     throw new DomainException({
  //       code: DomainExceptionCode.Unauthorized,
  //       message: 'Invalid username or password',
  //     });
  //   }
  //
  //   return { id: user._id.toString() };
  // }
}
