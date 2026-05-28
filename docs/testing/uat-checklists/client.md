# UAT Checklist - Client

Release date:
Environment:
Tester:

## A. Auth and Access (`F01`)
1. `UAT-AUTH-01` Login as client and confirm client routes open.
Expected:
Admin and cleaner-only pages are blocked with proper redirect/forbidden behavior.
2. `UAT-AUTH-02` Logout and try opening a previously open protected URL.
Expected:
User is redirected to login and cannot view protected data.

## B. Booking Draft and Recovery (`F04`)
1. `UAT-DRAFT-01` Start booking flow and fill step 1.
2. Refresh browser.
Expected:
Step 1 values persist exactly.
3. Continue to step 2, upload photos/instructions, refresh again.
Expected:
Step 2 state restores without crash or data loss.
4. Continue to step 3 and simulate interruption (navigate away and back).
Expected:
Flow resumes safely at latest valid step.

## C. Pricing and Booking Creation (`F05`)
1. `UAT-PRICE-01` Verify shown subtotal/platform fee/total before payment.
Expected:
Values match server preview and final booking summary.
2. `UAT-PRICE-02` Repeat for 1h, 2.5h, and 8h duration.
Expected:
Rounding is consistent and totals are correct.

## D. Payment Authorization and Request Submission (`F06`)
1. `UAT-PAYAUTH-01` Authorize payment with a successful test card.
Expected:
Booking moves to `Pending Cleaner Acceptance`.
2. `UAT-PAYAUTH-01` Run failure card path.
Expected:
Clear recoverable error with no duplicate pending request.
3. `UAT-PAYAUTH-02` Retry submit once after failure.
Expected:
Only one active request is created for the same booking.

## E. Client Signoff
1. Pass/Fail:
2. Blocking issues found:
3. Ticket links:
4. Notes:
