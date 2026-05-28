# UAT Checklist - Cleaner

Release date:
Environment:
Tester:

## A. Auth and Access (`F01`)
1. `UAT-AUTH-01` Login as cleaner and confirm cleaner routes open.
Expected:
Client/admin-only pages are blocked with proper redirect/forbidden behavior.

## B. Booking Request Reception (`F06`)
1. `UAT-PAYAUTH-02` Have client submit authorized booking request.
Expected:
Cleaner receives exactly one request notification.
2. Open cleaner bookings list and detail.
Expected:
Request status shows `Pending Cleaner Acceptance` and timestamps are consistent.

## C. Accept/Decline/Proposal (`F07`)
1. `UAT-PROPOSAL-01` Accept a pending request in valid window.
Expected:
Client and cleaner both see consistent accepted/confirmed outcome.
2. `UAT-PROPOSAL-01` Decline another pending request.
Expected:
Request closes with correct end-state and no stale actionable CTA.
3. `UAT-PROPOSAL-02` Send counter-proposal and have client accept.
Expected:
Booking time and status update consistently on both sides.

## D. Start/Complete Lifecycle (`F08`)
1. `UAT-LIFECYCLE-01` Start job in allowed window.
Expected:
Status moves to `in_progress`; start metadata appears correctly.
2. `UAT-LIFECYCLE-02` Complete job.
Expected:
Status moves to `completed` and payment status begins post-completion path.

## E. Cleaner Signoff
1. Pass/Fail:
2. Blocking issues found:
3. Ticket links:
4. Notes:
