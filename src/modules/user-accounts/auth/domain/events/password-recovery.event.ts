export class PasswordRecoveryEvent {
  constructor(
    public readonly email: string,
    public readonly recoveryCode: string,
  ) {}
}
