import { CreateUserDto } from '../../dto/create-user.dto';
import { Injectable } from '@nestjs/common';
import { CryptoService } from '../services/crypto.service';
import { User } from '../../domain/entities/user.entity';
import { UserCreateDomainDto } from '../../domain/dto/user.create-domain-dto';
import { DateService } from '../services/date.service';

@Injectable()
export class UsersFactory {
  constructor(
    private readonly cryptoService: CryptoService,
    private readonly dateService: DateService,
  ) {}
  async create(dto: CreateUserDto): Promise<User> {
    const { email, login, password } = dto;

    const passwordHash: string = await this.cryptoService.createPasswordHash(password);
    const confirmationCode: string = this.cryptoService.generateUUID();
    const expirationDate: Date = this.dateService.generateExpirationDate({ hours: 1 });

    const userCreateDomainDto: UserCreateDomainDto = {
      email,
      login,
      passwordHash,
      confirmationCode,
      expirationDate,
    };

    return User.create(userCreateDomainDto);
  }
}
