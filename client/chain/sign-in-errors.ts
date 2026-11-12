/** Sign-in errors and texts shared by the email session, the Privy bridge, the backend and the sign-in panel. */

export const EMAIL_NOT_LOADED = "Email sign-in could not load. Check your connection and try again.";

/** The email code was wrong or expired: the player may try another code without asking for a new one. */
export class WrongCodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WrongCodeError";
  }
}
