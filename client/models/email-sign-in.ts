const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_PATTERN = /^\d{6}$/;
export const EMAIL_RESEND_DELAY_MS = 30_000;

export function validEmail(value: string): string | null {
  const email = value.trim();
  return email.length <= 254 && EMAIL_PATTERN.test(email) ? email : null;
}

export function validCode(value: string): string | null {
  const code = value.replace(/\s/g, "");
  return CODE_PATTERN.test(code) ? code : null;
}

export function resendDelaySeconds(retryAt: number, now: number): number {
  return Math.max(0, Math.ceil((retryAt - now) / 1000));
}
