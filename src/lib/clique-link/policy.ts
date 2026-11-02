import { createHash, timingSafeEqual } from 'node:crypto';

export const CHALLENGE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const EXTERNAL_SUBJECT = /^[a-zA-Z0-9][a-zA-Z0-9_.:@-]{2,127}$/;
const ORIGIN = /^https:\/\/[a-z0-9.-]+(?::\d{2,5})?$/i;

export function isTrustedOrigin(raw: string | null, configured: string | undefined): boolean {
  if (!raw || !configured) return false;
  try {
    const url = new URL(raw);
    if (url.origin !== raw || !ORIGIN.test(raw)) return false;
    return configured.split(',').map(x => x.trim()).filter(Boolean).some(item => item === url.origin);
  } catch { return false; }
}

export function validCompleteRequest(body: unknown):
  body is { challenge: string; externalSubject: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
  const row = body as Record<string, unknown>;
  return typeof row.challenge === 'string' && CHALLENGE.test(row.challenge) &&
    typeof row.externalSubject === 'string' && EXTERNAL_SUBJECT.test(row.externalSubject);
}

export function secureSecretMatch(provided: string | null, expected: string | undefined): boolean {
  if (!expected || expected.length < 32 || !provided || provided.length > 512) return false;
  const a = createHash('sha256').update(provided).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a,b);
}
export function validatedHttpsOrigin(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.origin !== raw || !ORIGIN.test(raw)) return null;
    return url.origin;
  } catch { return null; }
}

export const DISABLED_RESPONSE = { error: 'linking_unavailable', message: 'Account linking is not configured.' };
