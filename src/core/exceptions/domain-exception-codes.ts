export enum DomainExceptionCode {
  //common
  NotFound = 'NotFound',
  BadRequest = 'BadRequest',
  InternalServerError = 'InternalServerError',
  Forbidden = 'Forbidden',
  ValidationError = 'ValidationError',
  //auth
  Unauthorized = 'Unauthorized',
  EmailNotConfirmed = 'EmailNotConfirmed',
  ConfirmationCodeExpired = 'ConfirmationCodeExpired',
  PasswordRecoveryCodeExpired = 'PasswordRecoveryCodeExpired',
}
