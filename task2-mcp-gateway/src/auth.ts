const TOKEN_ROLES: Record<string, string> = {
  "admin-token-123": "admin",
  "viewer-token-456": "viewer",
};

export type AuthResult =
  | { ok: true; role: string }
  | { ok: false; reason: string };

export function resolveRoleFromHeader(authHeader: string | undefined): AuthResult {
  if (!authHeader) {
    return { ok: false, reason: "Missing Authorization header" };
  }
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return { ok: false, reason: "Authorization header must be 'Bearer <token>'" };
  }
  const token = match[1].trim();
  const role = TOKEN_ROLES[token];
  if (!role) {
    return { ok: false, reason: "Unknown or invalid token" };
  }
  return { ok: true, role };
}
