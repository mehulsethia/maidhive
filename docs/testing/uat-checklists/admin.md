# UAT Checklist - Admin

Release date:
Environment:
Tester:

## A. Auth and Admin Boundary (`F01`, `F15`)
1. `UAT-AUTH-01` Login as admin and open admin dashboard/routes.
Expected:
Admin views are accessible.
2. `UAT-SEC-01` Attempt same admin route with client or cleaner account.
Expected:
Access is denied.

## B. Cleaner Approval and Ops Queue (`F14`)
1. `UAT-ADMIN-01` Review pending cleaner and perform approve flow.
Expected:
Cleaner status updates and downstream readiness is reflected.
2. `UAT-ADMIN-01` Open ops queue after booking requests are created.
Expected:
Queue ordering and urgency labels are correct.

## C. Booking and Payment Oversight (`F09`, `F10`)
1. `UAT-CANCEL-02` Validate cancellation outcomes for pending and confirmed bookings.
Expected:
Admin sees consistent booking state + payment side effects.
2. `UAT-PAY-02` Verify dispute create and resolve path.
Expected:
Dispute state transitions are reflected in admin views.

## D. Notification and Deep Links (`F13`)
1. `UAT-NOTIF-01` Trigger admin-facing notification and open it.
Expected:
Deep-link lands on the exact task page.

## E. Admin Signoff
1. Pass/Fail:
2. Blocking issues found:
3. Ticket links:
4. Notes:
