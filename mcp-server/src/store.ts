import type { CalendarEvent } from "./schema.js";

export interface IngestResult {
  received: number;
  new: number;
  duplicates: number;
}

export interface EventStore {
  ingest(userId: string, events: CalendarEvent[]): Promise<IngestResult>;
}

/**
 * Idempotency key: user + event_id + updated_at.
 *
 * The user is part of the key because a shared meeting can have the same event_id on every
 * attendee's calendar (Google Calendar does this), so two colleagues must not dedupe each other.
 * A null updated_at is keyed as "null", so an event whose calendar gives no timestamp is stored once.
 */
export function dedupeKey(userId: string, e: CalendarEvent): string {
  return JSON.stringify([userId, e.event_id, e.updated_at ?? null]);
}

/**
 * In-memory store. Data is lost on restart and isn't shared across instances.
 *
 * TODO(postgres): replace with a Postgres-backed store, e.g.
 *   CREATE TABLE calendar_events (
 *     user_id     text        NOT NULL,
 *     event_id    text        NOT NULL,
 *     updated_at  timestamptz NULL,
 *     payload     jsonb       NOT NULL,
 *     received_at timestamptz NOT NULL DEFAULT now()
 *   );
 *   CREATE UNIQUE INDEX calendar_events_dedupe
 *     ON calendar_events (user_id, event_id, updated_at) NULLS NOT DISTINCT;  -- Postgres 15+
 *   -- plus a sync_runs(user_id, run_at, event_count) table so empty runs are recorded too.
 * and insert with `INSERT ... ON CONFLICT DO NOTHING RETURNING event_id` to count new rows.
 */
export class InMemoryEventStore implements EventStore {
  private readonly seen = new Set<string>();

  async ingest(userId: string, events: CalendarEvent[]): Promise<IngestResult> {
    let fresh = 0;
    let duplicates = 0;
    for (const e of events) {
      const key = dedupeKey(userId, e);
      if (this.seen.has(key)) {
        duplicates++;
      } else {
        this.seen.add(key);
        fresh++;
      }
    }
    return { received: events.length, new: fresh, duplicates };
  }
}
