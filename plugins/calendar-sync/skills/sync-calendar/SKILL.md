---
name: sync-calendar
description: Send the user's finished calendar meetings to the team's time-tracking system right now, on demand. Use when the user types /sync-calendar or /calendar-sync:sync-calendar, or says "sync my calendar now", "push my meetings", "send yesterday's meetings", "log last week's meetings", or names days to sync.
---

# Sync my calendar now

The person you're helping is not technical. Use plain, friendly words. Don't say "MCP", "server", "tool", "API", "schema", "JSON" or "prompt". Keep messages short.

## Step 1: Check both connections

- Find a tool that lists events from **Google Calendar** or **Outlook / Microsoft 365**. If there's none, say:

  > First, Claude needs to see your calendar. Click **Customize** in the left sidebar, open **Connectors**, find **Google Calendar** (or **Outlook**), click **Connect**, and sign in. Tell me "done" when it's connected.

  Then stop and wait. If both are connected, ask which one holds their work meetings.

- Find the `submit_events` tool from the **calendar-sync-api** connector. If it isn't there, say:

  > Next, connect Calendar Sync. Click **Customize** in the left sidebar, open **Plugins**, choose **Calendar Sync**, and open the **Connectors** tab. Next to **calendar-sync-api**, click **Connect** and sign in. Tell me "done" when it shows Connected.

  Then stop and wait.

Don't mention these checks when both connections are there.

## Step 2: Work out the days

1. Work out the person's time zone from what you know about them (their device, profile or earlier messages). If you can't tell, ask. Use the IANA name (for example `America/Denver`) for your own use only.
2. Use the days they asked for: "yesterday", "last week", "Monday", "Nov 3 to Nov 7" and so on. If they didn't name any days, use the past 7 days up to now.
3. The window is from 00:00 on the first day to 24:00 on the last day, in their time zone, but never later than the current time. Only meetings that have already finished are sent, so a day still in progress only sends what's over.
4. Don't ask them to confirm the days. Go straight to Step 3.

## Step 3: Read the calendar

List every event on their primary calendar that overlaps the window. Include all-day events. If the results come in pages, fetch every page.

If the calendar can't be read, tell them in one sentence and stop. Don't send anything.

Skip an event if any of these is true:

- it hasn't finished yet: its end time is later than the current time,
- it's cancelled,
- they declined it (their own response is "declined"), or
- its title is missing or blank.

## Step 4: Send

For each remaining event, build an object with exactly these fields, using only values the calendar returned:

- `event_id`: the calendar's own ID for the event. For a repeating event, the ID of that day's occurrence. If an event has no ID, skip it.
- `title`: the event title, as written.
- `start`: the start time in ISO 8601 with the UTC offset of their time zone, for example `2026-11-09T09:00:00-07:00`. For an all-day event, 00:00:00 on its first day.
- `end`: the end time in the same format. For an all-day event, 00:00:00 on the day after its last day.
- `attendees_count`: the number of attendees listed, or 0 if none.
- `is_all_day`: true for an all-day event, otherwise false.
- `status`: `"confirmed"`.
- `updated_at`: when the event was last changed, in ISO 8601 with a UTC offset, from the calendar, or null if it doesn't say.

Call `submit_events` once with all of them in a single `events` array. If more than 200 events remain, send them in batches of 200.

Never invent events or values, never add other fields, and never call anything that changes their calendar. Meetings that were sent before are ignored by the time-tracking system, so sending them again is harmless.

## Step 5: Tell them what happened

In one or two short sentences, using the numbers `submit_events` returned:

- the days covered,
- how many meetings were added,
- how many were already there (duplicates),
- how many were skipped because they overlap time they'd already logged (overlaps), only if any.

For example:

> Done: Nov 9 to Nov 12. 13 meetings were added to your timesheet. Nothing was already there.

If they haven't set up the daily sync yet, add: "To do this automatically every weekday morning, type /setup-calendar-sync."
