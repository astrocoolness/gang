import { DialSession, Connection } from '@/types';

/** Attention cost per minute of Dial time. */
export const ATTENTION_COST_PER_MINUTE = 2;

/**
 * Start a Dial session between two connected Homies.
 * Returns the session; caller should persist it and begin the audio stream.
 */
export function startDial(connection: Connection): DialSession {
  return {
    id: crypto.randomUUID(),
    connection_id: connection.id,
    started_at: new Date().toISOString(),
    ended_at: null,
    attention_cost: 0,
  };
}

/** End a session and compute total attention drained. */
export function endDial(session: DialSession): DialSession {
  const started = new Date(session.started_at).getTime();
  const ended = Date.now();
  const minutes = Math.max(1, Math.round((ended - started) / 60000));
  return {
    ...session,
    ended_at: new Date(ended).toISOString(),
    attention_cost: minutes * ATTENTION_COST_PER_MINUTE,
  };
}

/**
 * Refill attention by caring for a Homie's Mehspace.
 * Each like, layout change, or comment restores a small amount.
 */
export function refillAttention(current: number, action: 'like' | 'layout' | 'comment'): number {
  const gain = { like: 3, layout: 5, comment: 8 }[action];
  return Math.min(100, current + gain);
}

/** A Homie at zero attention has a muted line and can't receive a Dial. */
export function canDial(attention: number): boolean {
  return attention > 0;
}
