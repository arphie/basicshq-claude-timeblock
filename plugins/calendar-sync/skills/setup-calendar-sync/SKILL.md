---
name: setup-calendar-sync
description: Set up calendar sync, a task that runs every weekday morning and sends the user's finished calendar events from the previous days to the team's time-tracking system. Use when the user types /setup-calendar-sync or /calendar-sync:setup-calendar-sync, or says "set up calendar sync", "turn on calendar sync", "sync my calendar", or asks to change the time their calendar sync runs.
---

# Set up calendar sync

The person you're helping is not technical. In everything you say to them:

- Use plain, friendly words. Don't say "MCP", "server", "tool", "API", "schema", "JSON", "cron" or "prompt".
- Give one step at a time, then wait for them.
- Keep each message to a few short sentences.

Do the steps below in order. Don't skip ahead.

## Step 1: Check the calendar connection

Look at the tools you have and find one that lists calendar events from **Google Calendar** or **Outlook / Microsoft 365**.

- If you find one, note which calendar it is and go to Step 2. Don't mention this check to the person.
- If you find neither, say this and then stop and wait:

  > First, Claude needs to see your calendar. Click **Customize** in the left sidebar, open **Connectors**, find **Google Calendar** (or **Outlook** if your work calendar is in Microsoft), click **Connect**, and sign in. When you're done, tell me "done".

  When they say they're done, check again. If both calendars are connected, ask which one holds their work meetings.

## Step 2: Check the Calendar Sync connection

Look for the `submit_events` tool from the **calendar-sync-api** connector.

- If it's there, go to Step 3.
- If it isn't, say this and then stop and wait:

  > Next, connect Calendar Sync. Click **Customize** in the left sidebar, open **Plugins**, choose **Calendar Sync**, and open the **Connectors** tab. Next to **calendar-sync-api**, click **Add** (if you see it) and then **Connect**, and sign in if asked. If you can't add it, ask your workspace admin to add it for you. Tell me "done" when it shows Connected.

  When they say they're done, check again.

## Step 3: Ask when to send the calendar

Work out the person's time zone from what you know about them (their device, profile or earlier messages). If you can't tell, ask them.

Ask one question:

> Calendar Sync sends your meetings once they've happened, so it runs each weekday morning and sends the meetings from the days before. Is 8:00 am, [their time zone, for example "New York time"], good for you, or would you like a different time?

- If they agree, use 8:00 am in that time zone.
- If they give another time or time zone, use theirs. Turn it into 24-hour time (for example 17:30) and an IANA time zone name (for example `America/New_York`) for your own use. Don't show those formats to them.

## Step 4: Create the scheduled task

1. Copy the text between the `BEGIN TASK PROMPT` and `END TASK PROMPT` lines in [Task prompt template](#task-prompt-template) below, exactly as written. Leave out the marker lines.
2. Replace only these placeholders:
   - `{{TIME_ZONE}}` with the IANA time zone name, for example `America/New_York`
   - `{{CALENDAR}}` with `Google Calendar` or `Outlook`, whichever you found in Step 1
3. Don't change, add or remove anything else in that text. The person doesn't write or edit it.
4. Create a scheduled task with the app's built-in scheduling, the feature that shows the person a proposed task to confirm with **Schedule**:
   - Name: `Daily calendar sync`
   - Instructions: the filled-in text from step 2
   - How often: weekdays (Monday to Friday) at the chosen time, in the chosen time zone. If the scheduler asks for a cron expression, use `MM HH * * 1-5`, with MM and HH taken from the chosen time.
   - If the scheduler asks about approval, leave its default.
5. If the app shows a **Schedule** button, ask the person to click it.

If a task named "Daily calendar sync" already exists, update that task's time instead of creating a second one.

If you can't create scheduled tasks here, give the person these steps instead, one message at a time:

> 1. Click **Scheduled** in the left sidebar, then **New task**, then **Set up manually**.
> 2. For the name, type **Daily calendar sync**.
> 3. Paste the text I'm about to give you into the instructions box.
> 4. Set it to run **on weekdays** at [their time].
> 5. Click **Save**.

Then give them the filled-in text from step 2 in a single code block so it's easy to copy.

## Step 5: Confirm

Tell the person what you set up in one sentence, then add the note about approvals. For example:

> All set: every weekday at 8:00 am New York time, Claude will send the meetings you've already had from your Google Calendar to the team's time-tracking system. Monday's run picks up Friday and the weekend.
>
> When it runs, it may ask you to approve sending your calendar. To let it run without asking, click **Scheduled** in the left sidebar, open **Daily calendar sync**, and change its approval setting to run automatically.

Stop there. Don't explain how the task works unless they ask.

## Task prompt template

This is the fixed text for the scheduled task. If you're a maintainer and change it, raise the plugin version. Tasks that people already created keep the old text until they run setup again.

```text
BEGIN TASK PROMPT
Daily calendar sync. This runs unattended, so don't ask me questions. Follow these steps exactly.

1. Work out the current date and time in the {{TIME_ZONE}} time zone. The sync window starts at 00:00 seven days before today and ends at 00:00 today, both in {{TIME_ZONE}}. Only meetings that have already finished are sent. Meetings that were sent before are ignored by the time-tracking system, so sending them again is expected and harmless.

2. Use the {{CALENDAR}} connector to list every event on my primary calendar that overlaps the sync window. Include all-day events. If the results come in pages, fetch every page.
   If the calendar can't be read (for example the connector is disconnected or returns an error), stop. Don't call submit_events. Reply with one line saying the calendar couldn't be read and why.

3. Skip an event if any of these is true:
   - it hasn't finished yet: its end time is later than the current time,
   - it's cancelled,
   - I declined it (my own response is "declined"), or
   - its title is missing or blank.

4. For each remaining event, build an object with exactly these fields, using only values the calendar returned:
   - event_id: the calendar's own ID for the event. For a repeating event, use the ID of that day's occurrence. If an event has no ID, skip it.
   - title: the event title, as written.
   - start: the start time in ISO 8601 with a UTC offset in {{TIME_ZONE}}, for example 2026-11-09T09:00:00-05:00. For an all-day event, use 00:00:00 on its first day.
   - end: the end time in the same format. For an all-day event, use 00:00:00 on the day after its last day.
   - attendees_count: the number of attendees listed on the event, or 0 if none are listed.
   - is_all_day: true for an all-day event, otherwise false.
   - status: "confirmed".
   - updated_at: when the event was last changed, in ISO 8601 with a UTC offset, taken from the calendar. If the calendar doesn't provide it, use null.

5. Call the submit_events tool from the calendar-sync-api connector once, with all the objects in a single "events" array. If no events remain, still call it once with an empty array, "events": [], so the server knows the run happened.

6. Never invent events or values, never add fields that aren't listed above, and never guess a missing value. Don't call any tool that changes my calendar.

7. Finish with one short line: the dates covered, how many events you sent, and the summary that submit_events returned.
END TASK PROMPT
```
