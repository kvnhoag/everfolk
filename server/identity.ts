export interface AdminEnvironment {
  ADMIN_EMAIL?: string;
  ADMIN_EMAILS?: string;
}

export interface SessionIdentity {
  authenticated: boolean;
  isAdmin: boolean;
}

/** Hosted identity headers are supplied by trusted Sites dispatch, not the browser. */
export function requestIdentity(headers: Pick<Headers, "get">, env: AdminEnvironment): SessionIdentity {
  const userId = headers.get("oai-authenticated-user-id")?.trim();
  const email = headers.get("oai-authenticated-user-email")?.trim().toLowerCase();
  const authenticated = Boolean(userId && email);
  const admins = [env.ADMIN_EMAIL ?? "", ...(env.ADMIN_EMAILS ?? "").split(/[,;\n]/)]
    .map(value => value.trim().toLowerCase()).filter(Boolean);
  return { authenticated, isAdmin: authenticated && admins.includes(email!) };
}
