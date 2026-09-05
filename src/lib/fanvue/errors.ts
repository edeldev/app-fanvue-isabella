export class FanvueError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "FanvueError";
  }
}

export class FanvueAuthenticationError extends FanvueError {
  constructor(
    code = "FANVUE_AUTHENTICATION_ERROR",
    status = 401,
    message = "Fanvue authentication failed",
  ) {
    super(message, status, code);
    this.name = "FanvueAuthenticationError";
  }
}
