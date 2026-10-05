/**
 * Error whose message is safe to show to the user. Throw it from module logic when the input is
 * invalid (wrong file, missing columns...). Any other error is treated as internal and hidden.
 */
export class UserFacingError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "UserFacingError";
    this.status = status;
  }
}

export class NotFoundError extends UserFacingError {
  constructor(message = "Recurso no encontrado.") {
    super(message, 404);
    this.name = "NotFoundError";
  }
}
