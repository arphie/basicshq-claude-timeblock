import * as z from "zod";

/** ISO 8601 date-time that must carry a UTC offset (e.g. 2026-11-09T09:00:00-05:00 or ...Z). */
const isoWithOffset = z.iso.datetime({ offset: true });

/**
 * One calendar event, as the scheduled task submits it.
 * Strict: unknown fields are rejected so the task can't quietly invent data.
 */
export const EventSchema = z.strictObject({
  event_id: z.string().min(1).describe("The calendar's own ID for the event (or for today's occurrence of a repeating event)."),
  title: z.string().trim().min(1).describe("Event title. Events with no title are skipped by the task, not sent."),
  start: isoWithOffset.describe("Start time, ISO 8601 with UTC offset. All-day events start at 00:00 local time."),
  end: isoWithOffset.describe("End time, ISO 8601 with UTC offset. All-day events end at 00:00 on the following day."),
  attendees_count: z.number().int().min(0).describe("Number of attendees listed on the event; 0 if none."),
  is_all_day: z.boolean(),
  status: z.enum(["confirmed", "cancelled"]),
  updated_at: isoWithOffset
    .nullable()
    .describe("When the event was last changed, ISO 8601 with UTC offset; null if the calendar doesn't provide it."),
});

export type CalendarEvent = z.infer<typeof EventSchema>;

/** Input shape for the submit_events tool. An empty array is valid and means "ran, no events today". */
export const SubmitEventsInput = {
  events: z.array(EventSchema).max(1000).describe("All of today's events. Send [] when there are none."),
};

export const SubmitEventsOutput = {
  received: z.number().int(),
  new: z.number().int(),
  duplicates: z.number().int(),
};
