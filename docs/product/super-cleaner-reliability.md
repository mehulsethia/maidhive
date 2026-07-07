# MaidHive Super Cleaner and Reliability System

Status: Locked  
Public feature default: Disabled  
Tracking default: Enabled

This document is the implementation source of truth for cleaner reliability and
Super Cleaner status.

## Eligibility

A cleaner is a Super Cleaner only when all criteria pass:

- At least 20 bookings with booking status `completed` and payment status
  `transferred` (“Completed – Released”).
- Internal average rating of at least 4.6.
- No admin-confirmed cleaner no-show in the preceding 60 days.
- Fewer than two last-minute cancellation incidents in the preceding 30 days.
- Cleaner cancellation rate strictly below 10%.
- At least 10 GPS-verified starts and an on-time rate of at least 90%.

The cancellation rate denominator is every accepted booking in the larger
history represented by the preceding 60 days or the last 20 accepted bookings.
Bookings later cancelled by the client or system remain in the denominator.
Only accepted bookings cancelled by the cleaner enter the numerator.

## Last-minute cancellation incidents and strikes

A booking cancellation is last-minute when an accepted booking is cancelled by
the cleaner strictly less than 12 hours before scheduled start.

Every cleaner cancellation is stored as a per-booking reliability event using
one of three mutually exclusive windows:

- `more_than_24h`: strictly more than 24 hours before scheduled start.
- `between_12h_24h`: from exactly 12 hours through exactly 24 hours.
- `less_than_12h`: strictly less than 12 hours before scheduled start.

The event records whether the booking had been accepted. Only accepted
`less_than_12h` events enter the rolling incident and strike rules. Every
accepted cleaner cancellation, regardless of window, remains part of the
cancellation-rate numerator.

All qualifying cancellations made on the same Cyprus calendar day form one
incident. Each affected booking still counts separately in the cancellation
rate.

- First incident: record it; do not issue a strike.
- Second incident with another incident in its preceding rolling 30 days:
  issue a strike and remove Super Cleaner immediately.
- Every subsequent incident with another incident in its preceding rolling
  30 days issues another strike.
- After a 30-day incident-free gap, the next incident is a new first incident.
- Reliability strikes expire after 90 days and do not automatically suspend
  the cleaner.

## Rest-of-today cancellation flow

The former “Full Day Off” behaviour is part of the normal cleaner cancellation
flow, not a separate feature. When cancelling a booking scheduled today, the
cleaner may select `I am unavailable for the rest of today`.

When selected, MaidHive:

- blocks the cleaner from now until the end of the current Cyprus calendar day;
- automatically cancels the cleaner’s remaining accepted or confirmed bookings
  scheduled for that same day;
- applies the normal cancellation/payment handling and client notification for
  each affected booking;
- records per-booking reliability events for every cancelled booking.

For reliability strikes, same-day affected cancellations still form one
incident. If one or more affected accepted bookings are cancelled less than
12 hours before scheduled start, that same-day incident is treated as a
last-minute cancellation incident. Cancellation-rate calculations still count
each accepted cleaner-cancelled booking individually.

An admin-confirmed cleaner no-show creates its own incident, issues a 90-day
strike, and removes Super Cleaner immediately. A client report alone does not.

## Recovery

Repeated-cancellation recovery requires 30 consecutive incident-free days,
three bookings completed during that period, and every eligibility criterion.
Only a new less-than-12-hour cleaner cancellation incident restarts this
recovery. Client, system, and cleaner cancellations made at least 12 hours
before start do not restart it.

No-show recovery requires 60 no-show-free days, five bookings completed during
that period, and every eligibility criterion. A new confirmed no-show restarts
it.

If both recovery types apply, both must clear. Active strikes do not need to
expire before status can be regained.

## GPS and public display

Google Geocoding snapshots trusted service coordinates at booking creation.
Manual Start Cleaning is verified only when device accuracy is at most 100
metres and the cleaner is within 100 metres of the booking coordinates. Starts
remain available without verification. System auto-starts never qualify.

A verified start is on time through 15 minutes after scheduled start. Public
on-time percentage appears after five verified jobs; otherwise display
`Not enough data yet`. Public ratings remain hidden until five
Completed–Released bookings.

The runtime configuration `super_cleaner.public_enabled` controls badges,
tooltip, booking indicators, and search priority. It defaults to `false`.
Public APIs never expose strikes, cancellation rate, or verified-job count.

## Deployment

1. Configure `GOOGLE_GEOCODING_API_KEY`.
2. Deploy the Prisma migration.
3. Preview historical incident classification:
   `npm run reliability:backfill`.
4. Apply incident backfill and geocode future accepted bookings:
   `npm run reliability:backfill -- --apply --geocode-future`.
5. Leave `super_cleaner.public_enabled=false` until the public launch decision.
