import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms & Conditions — MaidHive',
  description: 'Read the Terms and Conditions for using MaidHive.',
}

export default function TermsPage() {
  return (
    <>
      {/* Header */}
      <div className="bg-gray-950 px-6 py-20 text-center">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">Terms &amp; Conditions</h1>
          <p className="text-gray-400 text-sm">
            Effective Date: 8 April 2026 &middot; Last Updated: 8 April 2026
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="bg-white px-6 py-16">
        <div className="max-w-3xl mx-auto">

          {/* Preamble */}
          <div className="mb-12 text-gray-600 leading-relaxed space-y-4 text-[15px]">
            <p>
              Welcome to MaidHive. These Terms and Conditions (&ldquo;Terms&rdquo;) govern your access to and use of the MaidHive platform, including our website, applications, and related services.
            </p>
            <p>
              MaidHive operates as a marketplace that connects Clients with independent Cleaners. MaidHive does not provide cleaning services and is not a party to the service agreement between Clients and Cleaners.
            </p>
            <p>
              By accessing or using the Platform, you agree to be bound by these Terms. If you do not agree, you should not use the Platform.
            </p>
          </div>

          {/* ─── Section 1 ─── */}
          <Section number="1" title="Definitions">
            <p>For the purposes of these Terms and Conditions, the following definitions apply:</p>
            <DefinitionList definitions={[
              ['"Platform"', 'means the MaidHive website, mobile applications, software systems and related services through which cleaning services may be requested, booked and managed.'],
              ['"MaidHive", "we", "us" or "our"', 'refers to the operator of the MaidHive platform.'],
              ['"Client"', 'means a user of the Platform who requests or books cleaning services through the Platform.'],
              ['"Cleaner"', 'means an independent service provider who offers cleaning services through the Platform after completing the applicable onboarding and approval process.'],
              ['"User"', 'means any individual who accesses or uses the Platform, including both Clients and Cleaners.'],
              ['"Booking"', 'means a confirmed reservation for cleaning services made through the Platform between a Client and a Cleaner.'],
              ['"Service Subtotal"', 'means the total price of cleaning services calculated as the Cleaner\u2019s hourly rate multiplied by the booked duration.'],
              ['"Platform Service Fee"', 'means the fee charged by MaidHive for facilitating bookings through the Platform, as described in Section 6.'],
              ['"Booking Duration"', 'means the period of time selected during the booking process for the performance of cleaning services.'],
              ['"Start Time"', 'means the scheduled time at which the cleaning services are expected to begin.'],
              ['"Completion Time"', 'means the scheduled end time of the Booking Duration.'],
              ['"Dispute Window"', 'means the twenty-four (24) hour period following completion of a booking during which a problem may be reported in accordance with these Terms.'],
              ['"Under Review"', 'means a booking status applied by the Platform when a dispute or problem report is being assessed by MaidHive.'],
              ['"Terms"', 'means these Terms and Conditions governing use of the Platform.'],
            ]} />
          </Section>

          {/* ─── Section 2 ─── */}
          <Section number="2" title="Eligibility, Accounts and Registration">
            <SubSection number="2.1" title="Eligibility">
              <p>To use the Platform, users must be at least eighteen (18) years of age and legally capable of entering into binding agreements.</p>
              <p>By creating an account or using the Platform, users represent and warrant that they meet these eligibility requirements.</p>
            </SubSection>

            <SubSection number="2.2" title="Account Registration">
              <p>Users must create an account in order to access certain features of the Platform, including booking or providing cleaning services.</p>
              <p>Users agree to provide accurate, complete and up-to-date information during the registration process and to keep their account information updated.</p>
              <p>Users are responsible for maintaining the confidentiality of their account credentials and for all activities conducted through their account.</p>
            </SubSection>

            <SubSection number="2.3" title="Client Account Requirements">
              <p>Before submitting a booking request, Clients may be required to complete certain account verification steps as determined by the Platform, which may include:</p>
              <BulletList items={[
                'email verification;',
                'phone number verification;',
                'providing a valid payment method; and',
                'providing a service address.',
              ]} />
              <p>MaidHive may require or permit additional verification measures from time to time in order to maintain platform security and trust.</p>
            </SubSection>

            <SubSection number="2.4" title="Cleaner Onboarding and Verification">
              <p>Individuals wishing to offer services as Cleaners must complete the Platform\u2019s onboarding and approval process.</p>
              <p>Cleaner onboarding may include:</p>
              <BulletList items={[
                'submission of a government-issued identity document;',
                'confirmation of the individual\u2019s legal right to work and provide services in Cyprus;',
                'acceptance of applicable Platform standards and policies; and',
                'review or approval by MaidHive.',
              ]} />
              <p>Cleaners are solely responsible for ensuring that they are legally entitled to work and provide services in Cyprus.</p>
            </SubSection>

            <SubSection number="2.5" title="Independent Service Providers">
              <p>Cleaners using the Platform act as independent service providers.</p>
              <p>Nothing in these Terms creates any partnership, joint venture, employment or agency relationship between MaidHive and any Cleaner.</p>
              <p>Cleaners are responsible for their own business operations, taxes, insurance and regulatory compliance.</p>
            </SubSection>

            <SubSection number="2.6" title="Account Integrity">
              <p>Users must not:</p>
              <BulletList items={[
                'create accounts using false or misleading information;',
                'impersonate another individual; or',
                'create multiple accounts for the purpose of circumventing Platform rules.',
              ]} />
              <p>MaidHive may suspend or terminate accounts where it reasonably believes these rules have been breached.</p>
            </SubSection>
          </Section>

          {/* ─── Section 3 ─── */}
          <Section number="3" title="Role of the Platform and Nature of the Service">
            <SubSection number="3.1" title="Marketplace Platform">
              <p>MaidHive operates an online marketplace that enables Clients to request and book cleaning services from independent Cleaners.</p>
              <p>The Platform provides technology infrastructure that allows users to:</p>
              <BulletList items={[
                'create accounts;',
                'view Cleaner profiles and availability;',
                'submit and accept booking requests;',
                'process payments through the Platform; and',
                'manage bookings and dispute reports.',
              ]} />
              <p>MaidHive does not itself provide cleaning services.</p>
            </SubSection>

            <SubSection number="3.2" title="Service Relationship Between Users">
              <p>When a booking is confirmed through the Platform, a service agreement is formed directly between the Client and the Cleaner.</p>
              <p>The Cleaner agrees to provide cleaning services to the Client for the agreed booking duration and price.</p>
              <p>MaidHive acts solely as a platform facilitating the connection between Clients and Cleaners and is not a party to the service agreement between them.</p>
            </SubSection>

            <SubSection number="3.3" title="Independent Service Providers">
              <p>Cleaners using the Platform operate as independent service providers.</p>
              <p>Nothing in these Terms creates any partnership, joint venture, employment or agency relationship between MaidHive and any Cleaner.</p>
              <p>Cleaners are solely responsible for:</p>
              <BulletList items={[
                'determining how the cleaning services are performed;',
                'providing their own equipment, supplies or transport where applicable;',
                'complying with applicable laws and regulations; and',
                'fulfilling their tax, social security or self-employment obligations.',
              ]} />
              <p>MaidHive does not supervise or control the manner in which cleaning services are performed.</p>
            </SubSection>

            <SubSection number="3.4" title="No Guarantee of Services">
              <p>MaidHive does not guarantee the quality, suitability, safety or legality of cleaning services performed by independent Cleaners.</p>
              <p>While MaidHive may provide features such as reviews, ratings, identity verification or dispute reporting tools, these features are intended to assist users and do not constitute a guarantee of service performance.</p>
              <p>Clients acknowledge that cleaning services are performed by independent Cleaners and not by MaidHive.</p>
            </SubSection>

            <SubSection number="3.5" title="Platform Enforcement">
              <p>MaidHive may monitor activity on the Platform and may take enforcement actions where users violate these Terms or other Platform rules.</p>
              <p>Such actions may include warnings, temporary suspension or permanent removal of a user account.</p>
              <p>These enforcement actions may apply to both Clients and Cleaners.</p>
            </SubSection>

            <SubSection number="3.6" title="Platform Role in Disputes">
              <p>MaidHive may provide tools for reporting problems and may review disputes in accordance with Section 8 of these Terms.</p>
              <p>Where disputes arise between Clients and Cleaners, MaidHive may review available information and determine an appropriate outcome within the scope of the Platform\u2019s dispute procedures.</p>
              <p>However, MaidHive does not assume responsibility for the underlying performance of services provided by independent Cleaners.</p>
            </SubSection>

            <SubSection number="3.7" title="No Endorsement of Service Providers">
              <p>The appearance of a Cleaner profile on the Platform does not constitute an endorsement, recommendation or guarantee by MaidHive.</p>
              <p>MaidHive may display information such as profiles, reviews, ratings, badges or other indicators relating to Cleaners for informational purposes only.</p>
              <p>Clients are responsible for evaluating whether a Cleaner is suitable for their needs before making a booking.</p>
            </SubSection>
          </Section>

          {/* ─── Section 4 ─── */}
          <Section number="4" title="Bookings, Acceptance and Payment Flow">
            <SubSection number="4.1" title="Booking Requests and Payment Authorisation">
              <p>A Client may submit a booking request through the Platform by selecting an approved Cleaner, date, start time and duration.</p>
              <p>At the moment a booking request is submitted, the Client must provide a valid payment method and MaidHive will place a payment authorisation via Stripe for the full booking amount. The booking status will be recorded as Pending Cleaner Acceptance.</p>
              <p>A payment authorisation is not a charge. It is a temporary hold or confirmation of available funds and does not result in the transfer of money at that stage.</p>
              <p>The Cleaner may accept or decline the booking request within the applicable response window determined by the Platform.</p>
              <p>A booking becomes Confirmed &mdash; Upcoming only when the Cleaner formally accepts the request through the Platform.</p>
              <p>If the Cleaner does not respond within the applicable response window, the booking request will automatically expire and any associated payment authorisation will be released.</p>
            </SubSection>

            <SubSection number="4.2" title="Booking Duration, Scheduling and Platform Rules">
              <p>Bookings are subject to the following platform rules:</p>
              <BulletList items={[
                'Minimum booking duration: one (1) hour.',
                'Maximum booking duration: eight (8) hours.',
              ]} />
              <p>Bookings may only be made within time slots made available by the Cleaner through the Platform.</p>
              <p>MaidHive enforces a mandatory fifteen (15) minute buffer before and after each confirmed booking in order to reduce scheduling conflicts. This buffer is applied automatically by the Platform and forms part of the booking structure.</p>
              <p>MaidHive may limit the maximum advance booking window. At the time of publication of these Terms, the maximum advance booking window is four (4) weeks from the date of booking.</p>
            </SubSection>

            <SubSection number="4.3" title="Same-Day Bookings">
              <p>Same-day bookings are permitted subject to Platform rules, including:</p>
              <BulletList items={[
                'A minimum lead time of two (2) hours prior to the scheduled start time; and',
                'Cleaner response windows determined by proximity to the scheduled start time.',
              ]} />
              <p>If the Cleaner does not respond within the applicable response window, the booking request will automatically expire and any payment authorisation will be released.</p>
            </SubSection>

            <SubSection number="4.4" title="Commencement of Services">
              <p>Cleaners are expected to begin services at or near the scheduled start time.</p>
              <p>Cleaners may mark a booking as In Progress by using the &ldquo;Start Cleaning&rdquo; function within a reasonable period around the scheduled start time, subject to internal Platform rules.</p>
              <p>The Platform may use time-based and location-based verification tools to determine on-time arrival and attendance for performance tracking and policy enforcement purposes. Such tools are not used for live tracking.</p>
            </SubSection>

            <SubSection number="4.5" title="Re-Authorisation for Future Bookings">
              <p>Where a booking is scheduled sufficiently far in advance that an initial authorisation may no longer remain valid at the time of service, MaidHive may require a further payment authorisation.</p>
              <p>For such bookings, MaidHive will prompt the Client forty-eight (48) hours before the scheduled start time to re-authorise the payment on-session.</p>
              <p>If the Client does not successfully complete re-authorisation within a twenty-four (24) hour grace period, the booking may be automatically cancelled by the system, the Cleaner\u2019s time slot will be released, and no penalties will apply to either party.</p>
            </SubSection>

            <SubSection number="4.6" title="Completion, Capture and Booking State Transitions">
              <p>The &ldquo;Complete Job&rdquo; function becomes available shortly before the scheduled end time (typically five (5) minutes prior). Cleaners may only mark a booking as completed once this function becomes available.</p>
              <p>Where services are completed earlier than the scheduled end time with the Client\u2019s agreement, the Cleaner may leave the service location but may only confirm completion through the Platform once the completion function becomes available.</p>
              <p>When the Cleaner selects &ldquo;Complete Job&rdquo;:</p>
              <BulletList items={[
                'The booking status moves to Completed \u2014 Awaiting Release;',
                'The Client\u2019s authorised payment is captured immediately via Stripe;',
                'A twenty-four (24) hour dispute window begins.',
              ]} />
              <p>If the Cleaner does not manually complete the booking, the Platform may automatically mark the booking as completed following the scheduled end time, provided:</p>
              <BulletList items={[
                'No cancellation has been recorded;',
                'No dispute has been raised; and',
                'No conflicting booking status exists.',
              ]} />
              <p>Upon automatic completion:</p>
              <BulletList items={[
                'The authorised payment is captured;',
                'The booking enters Completed \u2014 Awaiting Release;',
                'The twenty-four (24) hour dispute window begins.',
              ]} />
              <p>All payment capture and release events are dependent upon booking state transitions as determined by the Platform.</p>
              <p>If a booking is cancelled prior to completion in accordance with these Terms, payment capture will not occur unless required under the applicable cancellation policy.</p>
            </SubSection>

            <SubSection number="4.7" title="Dispute Window and Payout Release">
              <p>Following capture of payment, funds are held during the twenty-four (24) hour dispute window.</p>
              <p>If no dispute is raised within that period, the booking status changes to Completed &mdash; Released, and payout is issued to the Cleaner in accordance with the Platform\u2019s payout schedule.</p>
              <p>If a dispute is raised within the dispute window:</p>
              <BulletList items={[
                'Payment capture remains in place;',
                'Payout to the Cleaner is paused;',
                'MaidHive will review and determine the outcome in accordance with Section 8 (Disputes and Problem Resolution).',
              ]} />
            </SubSection>

            <SubSection number="4.8" title="Failed Payments and Payment Method Issues">
              <p>Clients are responsible for ensuring that their payment method remains valid and capable of authorisation and capture.</p>
              <p>If authorisation, re-authorisation or capture fails, or if a payment method becomes invalid, MaidHive may:</p>
              <BulletList items={[
                'Request the Client to update their payment details;',
                'Place the booking into a payment-related holding state;',
                'Cancel the booking in accordance with Platform rules; and/or',
                'Delay payout pending successful payment resolution.',
              ]} />
              <p>MaidHive shall not be liable for losses arising from a Client\u2019s failure to maintain a valid and chargeable payment method.</p>
            </SubSection>

            <SubSection number="4.9" title="Platform Service Fee">
              <p>MaidHive charges a flat ten per cent (10%) service fee on the total booking value (calculated as the Cleaner\u2019s hourly rate multiplied by the booked duration).</p>
              <p>The service fee is incorporated into the transaction structure and retained by MaidHive in accordance with the Platform\u2019s payment and cancellation policies.</p>
            </SubSection>
          </Section>

          {/* ─── Section 5 ─── */}
          <Section number="5" title="Cancellation, No-Show and Refund Policies">
            <SubSection number="5.1" title="Client Cancellation">
              <p>A Client may cancel a confirmed booking through the Platform. The financial consequences of cancellation depend strictly on the time remaining before the scheduled start time of the booking, as recorded by the Platform.</p>

              <h4 className="text-sm font-semibold text-gray-900 mt-6 mb-2">(a) Cancellation more than twenty-four (24) hours before the scheduled start time</h4>
              <p>Where a Client cancels more than twenty-four (24) hours before the scheduled start time:</p>
              <BulletList items={[
                'The Stripe payment authorisation will be fully released;',
                'No payment will be captured;',
                'No platform fee will be retained;',
                'The Cleaner will not receive any payment.',
              ]} />

              <h4 className="text-sm font-semibold text-gray-900 mt-6 mb-2">(b) Cancellation between twelve (12) and twenty-four (24) hours before the scheduled start time</h4>
              <p>Where a Client cancels between twelve (12) and twenty-four (24) hours before the scheduled start time:</p>
              <BulletList items={[
                'MaidHive will capture a fixed administrative fee of five euros (\u20AC5) from the authorised amount;',
                'The remainder of the authorised amount will be released;',
                'The Cleaner will not receive any payment in this window.',
              ]} />
              <p>The \u20AC5 administrative fee is retained by MaidHive to cover operational and administrative costs arising from late cancellations.</p>

              <h4 className="text-sm font-semibold text-gray-900 mt-6 mb-2">(c) Cancellation less than twelve (12) hours before the scheduled start time</h4>
              <p>Where a Client cancels less than twelve (12) hours before the scheduled start time:</p>
              <BulletList items={[
                'MaidHive will capture an amount equal to fifty per cent (50%) of the service subtotal (being the Cleaner\u2019s hourly rate multiplied by the booked duration), plus',
                'The full ten per cent (10%) platform service fee calculated on the service subtotal;',
                'The remainder of the authorised amount will be released to the Client.',
              ]} />
              <p>For the avoidance of doubt:</p>
              <BulletList items={[
                'The Cleaner will receive fifty per cent (50%) of the service subtotal;',
                'MaidHive will retain the full ten per cent (10%) platform service fee.',
              ]} />
              <p>All calculations are performed automatically by the Platform based on the booking value recorded at the time of confirmation.</p>
              <p>Where a cancellation fee becomes payable under this Section, MaidHive may capture the applicable amount immediately at the time the cancellation is recorded.</p>
            </SubSection>

            <SubSection number="5.2" title="Client No-Show">
              <p>A Client is considered a &ldquo;no-show&rdquo; where:</p>
              <BulletList items={[
                'The Cleaner attends the booking location at or near the scheduled start time;',
                'The Cleaner waits a reasonable period (generally around thirty (30) minutes); and',
                'The Client fails to provide access or otherwise make themselves available for the service.',
              ]} />
              <p>The &ldquo;Client no-show&rdquo; reporting option becomes available thirty (30) minutes after the scheduled start time.</p>
              <p>Where a Client no-show is verified by MaidHive:</p>
              <BulletList items={[
                'The full booking value will be captured (if not already captured);',
                'The Cleaner will receive the service subtotal;',
                'MaidHive will retain the full platform service fee;',
                'No refund will be issued to the Client.',
              ]} />
              <p>The Cleaner may be required to provide reasonable evidence of attendance and attempted contact.</p>
            </SubSection>

            <SubSection number="5.3" title="Cleaner Cancellation">
              <p>If a Cleaner cancels a confirmed booking prior to the commencement of services:</p>
              <BulletList items={[
                'The Client will receive a full refund;',
                'Any payment authorisation will be released or, if already captured, fully refunded;',
                'MaidHive will not retain the platform service fee.',
              ]} />
              <p>Cleaners may be subject to performance measures, warnings, suspension or removal from the Platform in accordance with MaidHive\u2019s internal policies.</p>
              <p>Where a Cleaner cancels after services have commenced, the matter will be handled under the dispute procedures set out in Section 8.</p>
            </SubSection>

            <SubSection number="5.4" title="Cleaner No-Show">
              <p>A Cleaner is considered a &ldquo;no-show&rdquo; where they fail to attend the booking location at or near the scheduled start time without valid reason.</p>
              <p>The &ldquo;Cleaner didn\u2019t arrive&rdquo; reporting option becomes available thirty (30) minutes after the scheduled start time.</p>
              <p>Where a Cleaner no-show is reported:</p>
              <BulletList items={[
                'The booking will move to Under Review;',
                'Automatic completion and payment capture will be paused if not yet triggered;',
                'Payout to the Cleaner will be blocked pending review.',
              ]} />
              <p>If MaidHive verifies the Cleaner no-show:</p>
              <BulletList items={[
                'The booking will be cancelled;',
                'Any outstanding payment authorisation will be released;',
                'If payment capture has already occurred, a full refund will be issued to the Client;',
                'The Cleaner may be subject to performance measures, suspension or removal.',
              ]} />
            </SubSection>

            <SubSection number="5.5" title="Early Completion of Services">
              <p>Completion of a booking prior to the scheduled end time does not automatically reduce the booking value.</p>
              <p>Where services are completed earlier than scheduled and no dispute is raised within the applicable dispute window, the full booking value remains payable.</p>
            </SubSection>

            <SubSection number="5.6" title="Dispute Window">
              <p>Disputes relating to cancellations, no-shows, incomplete services or quality concerns must be raised through the Platform within twenty-four (24) hours of booking completion.</p>
              <p>After this period, payments are considered final and non-refundable subject to applicable law, except in cases of fraud or clear administrative error.</p>
              <p>Where a dispute is raised within the permitted window:</p>
              <BulletList items={[
                'Payment capture (if already effected) shall remain in place;',
                'Payout to the Cleaner shall be paused pending review;',
                'MaidHive shall review the evidence provided by both parties and determine an outcome in its reasonable discretion.',
              ]} />
            </SubSection>

            <SubSection number="5.7" title="Platform Determination">
              <p>MaidHive\u2019s determination of:</p>
              <BulletList items={[
                'cancellation timing;',
                'no-show evidence;',
                'booking state transitions; and',
                'refund calculations,',
              ]} />
              <p>shall be based on the Platform\u2019s recorded timestamps, system data and submitted evidence.</p>
              <p>Such determinations shall be final for the purposes of platform operation, subject to applicable law.</p>
            </SubSection>
          </Section>

          {/* ─── Section 6 ─── */}
          <Section number="6" title="Payments, Fees and Payouts">
            <SubSection number="6.1" title="Payment Processing">
              <p>All payments made through the Platform are processed using a third-party payment service provider, currently Stripe.</p>
              <p>By submitting a booking request, the Client authorises MaidHive to initiate payment authorisation, capture and transfer of funds through Stripe in accordance with these Terms.</p>
              <p>MaidHive does not store full payment card details and relies on Stripe\u2019s secure infrastructure for payment processing, fraud protection and regulatory compliance.</p>
              <p>Payment authorisation, capture and release are governed by the booking state transitions described in Section 4 (Bookings, Acceptance and Payment Flow) and the cancellation rules set out in Section 5 (Cancellation, No-Show and Refund Policies).</p>
            </SubSection>

            <SubSection number="6.2" title="Platform Service Fee">
              <p>MaidHive charges a platform service fee of ten per cent (10%) of the service subtotal for each confirmed booking.</p>
              <p>The Platform Service Fee applies to bookings completed through the Platform and may also apply to certain cancellation outcomes as described in Section 5.</p>
              <p>For the purposes of these Terms:</p>
              <BulletList items={[
                'Service Subtotal means the Cleaner\u2019s hourly rate multiplied by the booked duration.',
                'The Platform Service Fee is calculated as ten per cent (10%) of the service subtotal.',
              ]} />
              <p>The Platform Service Fee is displayed to the Client during the booking process and forms part of the total transaction amount authorised at the time the booking request is submitted.</p>
              <p>The Platform Service Fee is retained by MaidHive in accordance with the booking flow, cancellation rules and dispute procedures described in these Terms.</p>
            </SubSection>

            <SubSection number="6.3" title="Payment Methods">
              <p>Clients may pay for bookings using payment methods supported by the Platform through Stripe.</p>
              <p>Accepted payment methods may include:</p>
              <BulletList items={[
                'debit cards;',
                'credit cards;',
                'Apple Pay; and',
                'Google Pay,',
              ]} />
              <p>or other payment methods supported by Stripe and enabled by the Platform from time to time.</p>
              <p>All payments are processed in Euro (\u20AC).</p>
              <p>Where a payment method involves currency conversion, such conversion will be handled by the payment provider and may be subject to additional fees imposed by the payment provider or the Client\u2019s financial institution.</p>
            </SubSection>

            <SubSection number="6.4" title="Payment Authorisation and Capture">
              <p>When a Client submits a booking request, MaidHive will place a payment authorisation via Stripe for the total booking amount.</p>
              <p>Authorisation is not a charge and does not transfer funds at that stage.</p>
              <p>Payment capture occurs when the booking transitions to Completed &mdash; Awaiting Release, as described in Section 4.</p>
              <p>Following capture, funds are held during the twenty-four (24) hour dispute window.</p>
              <p>If no dispute is raised within that period, the booking transitions to Completed &mdash; Released, at which point payout to the Cleaner is initiated.</p>
            </SubSection>

            <SubSection number="6.5" title="Cleaner Payouts">
              <p>Cleaners receive payment for completed bookings in accordance with the payout structure defined by the Platform.</p>
              <p>Where a booking reaches Completed &mdash; Released status and no dispute has been raised, MaidHive will initiate a payout to the Cleaner through Stripe.</p>
              <p>Actual receipt of funds may depend on Stripe processing timelines and the Cleaner\u2019s payout account configuration.</p>
              <p>MaidHive does not guarantee exact payout timing once the transfer has been initiated through Stripe.</p>
            </SubSection>

            <SubSection number="6.6" title="Payment Processing Fees">
              <p>Payment processing fees charged by Stripe are paid by MaidHive and are not deducted from the Cleaner\u2019s payout amount.</p>
              <p>Cleaners receive the payout amount owed to them under the applicable booking, cancellation or dispute outcome without deduction for Stripe processing fees.</p>
            </SubSection>

            <SubSection number="6.7" title="Tips">
              <p>The Platform may allow Clients to provide voluntary tips to Cleaners following completion of a booking.</p>
              <p>Tips are optional and are processed through the Platform\u2019s payment system.</p>
              <p>Where a Client provides a tip:</p>
              <BulletList items={[
                'the full value of the tip will be transferred to the Cleaner;',
                'MaidHive does not charge a platform service fee on tips; and',
                'any payment processing fees associated with tips are absorbed by MaidHive.',
              ]} />
              <p>Tips are separate from the service subtotal and do not affect the calculation of the Platform Service Fee.</p>
            </SubSection>

            <SubSection number="6.8" title="Taxes and Financial Responsibilities">
              <p>Cleaners using the Platform operate as independent service providers and are solely responsible for:</p>
              <BulletList items={[
                'declaring and paying all applicable taxes;',
                'complying with VAT obligations where applicable; and',
                'fulfilling any self-employment, social insurance or regulatory obligations required under applicable law.',
              ]} />
              <p>MaidHive does not act as an employer, payroll provider or tax agent for Cleaners.</p>
              <p>Clients are responsible for paying the total booking amount shown during the booking process.</p>
            </SubSection>

            <SubSection number="6.9" title="Payments Outside the Platform">
              <p>To protect the integrity of the marketplace, services arranged through the Platform must be paid through the Platform.</p>
              <p>Clients and Cleaners agree not to request, solicit or accept payment for services arranged through MaidHive outside the Platform.</p>
              <p>MaidHive may take enforcement action, including suspension or removal of accounts, where it determines that users have attempted to circumvent the Platform\u2019s payment system.</p>
            </SubSection>

            <SubSection number="6.10" title="Chargebacks and Payment Disputes">
              <p>If a Client initiates a chargeback or payment dispute with their payment provider in relation to a booking made through the Platform, MaidHive reserves the right to investigate the circumstances of the dispute.</p>
              <p>Where MaidHive reasonably determines that the chargeback is unfounded or abusive, MaidHive may:</p>
              <BulletList items={[
                'suspend or terminate the Client\u2019s account;',
                'recover amounts owed to the Platform or Cleaner where permitted by law; or',
                'take other enforcement actions in accordance with these Terms.',
              ]} />
              <p>Users agree to first contact MaidHive through the Platform\u2019s dispute procedures before initiating a chargeback with their payment provider.</p>
            </SubSection>
          </Section>

          {/* ─── Section 7 ─── */}
          <Section number="7" title="Platform Rules and User Responsibilities">
            <SubSection number="7.1" title="General Conduct">
              <p>Users of the Platform must behave respectfully and professionally when interacting with other users.</p>
              <p>Users must not engage in conduct that is abusive, threatening, discriminatory, harassing or otherwise inappropriate toward other users of the Platform.</p>
              <p>MaidHive may investigate complaints relating to user conduct and may take enforcement action, including warnings, suspension or removal of accounts, where it determines that a user has breached these conduct standards.</p>
            </SubSection>

            <SubSection number="7.2" title="Communication Through the Platform">
              <p>Communication between Clients and Cleaners relating to bookings should take place through the Platform where possible.</p>
              <p>Users must not attempt to exchange personal contact details or arrange services outside the Platform prior to a confirmed booking.</p>
              <p>Users must not use the Platform to solicit or arrange services outside the Platform in order to avoid the Platform Service Fee.</p>
              <p>Where MaidHive determines that a user has attempted to circumvent the Platform\u2019s booking or payment systems, MaidHive may take enforcement action including suspension or termination of the user\u2019s account.</p>
            </SubSection>

            <SubSection number="7.3" title="Client Responsibilities">
              <p>Clients are responsible for ensuring that the information provided in connection with a booking is accurate and complete.</p>
              <p>In particular, Clients must:</p>
              <BulletList items={[
                'provide the correct service address for the booking;',
                'provide clear and accurate instructions for property access where necessary;',
                'ensure that the service location is safe for the Cleaner to perform the requested services; and',
                'ensure that pets, hazards or other conditions that may pose a risk to the Cleaner are appropriately managed.',
              ]} />
              <p>Where a Client fails to provide accurate information, fails to provide access to the property, or otherwise prevents the Cleaner from performing the booked services, the booking may be treated as a Client No-Show in accordance with Section 5.</p>
              <p>Clients are responsible for securing pets, disclosing hazardous conditions and ensuring that the working environment does not pose a risk to the Cleaner.</p>
            </SubSection>

            <SubSection number="7.4" title="Property Access Arrangements">
              <p>Clients may provide instructions for accessing the property where they are not present at the time of the booking. Such arrangements may include, for example, key safes, building concierge access, neighbours holding keys, or other entry methods.</p>
              <p>Where a Client provides such instructions:</p>
              <BulletList items={[
                'the Client is responsible for the security of the access method; and',
                'MaidHive is not responsible for the security or reliability of such arrangements.',
              ]} />
              <p>Cleaners may rely on the instructions provided by the Client in order to access the property.</p>
              <p>MaidHive does not supervise property access arrangements and accepts no responsibility for the security of entry methods arranged between Clients and Cleaners.</p>
            </SubSection>

            <SubSection number="7.5" title="Safety and Hazard Disclosure">
              <p>Clients must ensure that the service location provides a safe working environment for the Cleaner.</p>
              <p>Clients must disclose any known hazards that may affect the safety of the Cleaner, including but not limited to:</p>
              <BulletList items={[
                'aggressive or unsecured animals;',
                'hazardous chemicals;',
                'unsafe electrical equipment; or',
                'structural hazards within the property.',
              ]} />
              <p>Cleaners may refuse to begin or continue services where they reasonably believe the environment is unsafe.</p>
            </SubSection>

            <SubSection number="7.6" title="Cleaner Responsibilities">
              <p>Cleaners must:</p>
              <BulletList items={[
                'attend bookings at or near the scheduled start time;',
                'perform services in a professional manner consistent with the booking description;',
                'respect the Client\u2019s property, privacy and instructions; and',
                'comply with applicable laws and safety standards when performing services.',
              ]} />
              <p>Cleaners must not misrepresent their identity, qualifications or services offered through the Platform.</p>
            </SubSection>

            <SubSection number="7.7" title="Refusal or Early Termination of Services">
              <p>Cleaners may refuse to begin or may terminate services where they reasonably believe that:</p>
              <BulletList items={[
                'the working environment is unsafe;',
                'access instructions provided by the Client are misleading or incorrect; or',
                'the Client behaves in an abusive, threatening or inappropriate manner.',
              ]} />
              <p>Where a Cleaner refuses to begin services due to circumstances attributable to the Client, the booking may be treated as a Client No-Show in accordance with Section 5.</p>
              <p>Where services have already commenced and are terminated early due to safety concerns or Client conduct, the financial outcome may be adjusted proportionally to reflect the time actually worked.</p>
              <p>Such matters may be reviewed by MaidHive under the dispute procedures set out in Section 8.</p>
            </SubSection>

            <SubSection number="7.8" title="Account Integrity">
              <p>Users must maintain accurate and truthful account information.</p>
              <p>Users must not:</p>
              <BulletList items={[
                'create accounts using false information;',
                'impersonate another individual; or',
                'create multiple accounts for the purpose of circumventing Platform rules.',
              ]} />
              <p>MaidHive may suspend or terminate accounts where it determines that a user has breached these requirements.</p>
            </SubSection>

            <SubSection number="7.9" title="Services Outside the Booking Scope">
              <p>The Platform facilitates bookings for services performed during the confirmed booking duration.</p>
              <p>Any services performed outside the confirmed booking scope or after the booking duration has ended are arrangements made directly between the Client and the Cleaner.</p>
              <p>MaidHive is not responsible for services performed outside the confirmed booking duration and such arrangements are not covered by the Platform\u2019s booking, payment or dispute processes.</p>
            </SubSection>

            <SubSection number="7.10" title="Prohibited Use of the Platform">
              <p>Users may not use the Platform for unlawful activities or for purposes that violate applicable laws or regulations.</p>
              <p>Prohibited conduct includes, but is not limited to:</p>
              <BulletList items={[
                'engaging in illegal activities;',
                'harassment or discrimination against other users;',
                'threatening behaviour; or',
                'misuse of the Platform\u2019s booking or payment systems.',
              ]} />
              <p>MaidHive reserves the right to take enforcement action, including account suspension or termination, where such conduct is identified.</p>
            </SubSection>

            <SubSection number="7.11" title="Platform Role and Liability">
              <p>Cleaners using the Platform operate as independent service providers.</p>
              <p>MaidHive does not supervise the performance of cleaning services and does not guarantee the quality, safety or legality of services provided by independent Cleaners.</p>
              <p>MaidHive does not provide insurance coverage for property damage, theft, personal injury or other losses arising from services performed by Cleaners.</p>
              <p>Any claims relating to property damage, theft or other losses arising during a booking are matters to be resolved between the Client and the Cleaner, subject to the dispute reporting procedures set out in Section 8.</p>
            </SubSection>
          </Section>

          {/* ─── Section 8 ─── */}
          <Section number="8" title="Disputes and Problem Resolution">
            <SubSection number="8.1" title="Reporting a Problem">
              <p>If a Client or Cleaner believes that an issue has occurred in connection with a booking, they may report the matter through the Platform using the &ldquo;Report a problem&rdquo; function.</p>
              <p>Reports may relate to issues including, but not limited to:</p>
              <BulletList items={[
                'service quality concerns;',
                'incomplete services;',
                'no-show incidents;',
                'access issues; or',
                'other booking-related disputes.',
              ]} />
              <p>Upon submission of a report, the booking may be placed into an Under Review status and, where appropriate, automatic booking completion, payment capture and/or payout may be paused depending on the type of report submitted and the current booking state, in accordance with these Terms.</p>
              <p>Certain reporting options, including no-show reports, become available only after defined time thresholds following the scheduled start time, as determined by the Platform.</p>
            </SubSection>

            <SubSection number="8.2" title="Dispute Window">
              <p>Disputes relating to a booking must be raised through the Platform within twenty-four (24) hours of booking completion.</p>
              <p>After this period, payments are considered final and non-refundable, subject to applicable law, except in cases of fraud or clear administrative error.</p>
              <p>Where a dispute is submitted within the permitted timeframe:</p>
              <BulletList items={[
                'payment capture (if already effected) shall remain in place; and',
                'payout to the Cleaner will remain paused pending the outcome of the review.',
              ]} />
            </SubSection>

            <SubSection number="8.3" title="Review Process">
              <p>When a dispute is raised, MaidHive will review the matter based on the available information and may consider any relevant evidence submitted through the Platform or recorded by the Platform.</p>
              <p>MaidHive may request additional information from either party where necessary to assess the matter.</p>
              <p>Reviews will be conducted within a reasonable timeframe, taking into account the nature and complexity of the issue.</p>
              <p>During the review period, the Platform may maintain the booking in an Under Review state until a determination has been reached.</p>
            </SubSection>

            <SubSection number="8.4" title="Possible Outcomes">
              <p>Following review of a dispute, MaidHive may determine an appropriate resolution in its reasonable discretion based on the available evidence.</p>
              <p>Possible outcomes may include:</p>
              <BulletList items={[
                'confirmation that the booking stands with no refund issued;',
                'a partial refund;',
                'a full refund;',
                'the issuance of a MaidHive platform credit;',
                'warnings or penalties applied to a Cleaner account;',
                'warnings, suspension or removal of a Client account; or',
                'other appropriate enforcement actions permitted under these Terms.',
              ]} />
              <p>Where a refund is issued, MaidHive will determine whether the refund is applied through payment reversal or platform credit depending on the circumstances.</p>
              <p>Following resolution of a dispute, MaidHive will determine whether payout is released to the Cleaner, whether a partial adjustment is made, or whether a refund is issued to the Client. Payouts are only released once the dispute has been resolved.</p>
            </SubSection>

            <SubSection number="8.5" title="Service Duration and Incomplete Services">
              <p>Bookings are based on a reserved service duration. Completion of services earlier than the scheduled end time does not automatically entitle the Client to a refund.</p>
              <p>However, where MaidHive determines that the service duration materially differed from the booked duration (for example, where a Cleaner leaves significantly earlier than the agreed booking period), MaidHive may adjust the financial outcome of the booking proportionally to reflect the time actually worked.</p>
              <p>In making this determination, MaidHive may consider available platform records including system timestamps, booking activity, location verification data, communications between users, and any other evidence submitted through the Platform.</p>
              <p>Such adjustments may include partial refunds or revised payout amounts where appropriate.</p>
            </SubSection>

            <SubSection number="8.6" title="Misuse of the Dispute System">
              <p>The dispute process is intended to resolve genuine issues arising from bookings.</p>
              <p>Misuse of the dispute system, including but not limited to:</p>
              <BulletList items={[
                'submitting knowingly false reports;',
                'attempting to obtain unwarranted refunds; or',
                'repeatedly submitting abusive or fraudulent claims,',
              ]} />
              <p>may result in enforcement actions including warnings, suspension, or removal from the Platform.</p>
            </SubSection>

            <SubSection number="8.7" title="Independent Service Providers and Platform Role">
              <p>Cleaners using the Platform operate as independent service providers and are not employees, agents or representatives of MaidHive.</p>
              <p>MaidHive does not supervise or control the manner in which cleaning services are performed and does not guarantee the quality, safety or legality of services provided by independent Cleaners.</p>
              <p>MaidHive does not provide insurance coverage for property damage, theft, personal injury or other losses arising from services performed by Cleaners.</p>
              <p>Any claims relating to property damage, theft or personal injury arising during a booking must be addressed between the Client and the Cleaner directly, subject to the dispute reporting procedures available through the Platform.</p>
            </SubSection>

            <SubSection number="8.8" title="Platform Determination">
              <p>MaidHive\u2019s determination of dispute outcomes shall be made in its reasonable discretion based on available evidence, including Platform records, system timestamps, and information submitted by the parties.</p>
              <p>Such determinations are final for the purposes of platform operation, subject to applicable law.</p>
            </SubSection>
          </Section>

          {/* ─── Section 9 ─── */}
          <Section number="9" title="Reviews and Ratings">
            <SubSection number="9.1" title="Client Reviews">
              <p>Following the completion of a booking, Clients may be invited to submit a review and rating relating to the Cleaner who performed the service.</p>
              <p>Reviews are intended to provide feedback about the Client\u2019s experience and to assist other users in evaluating Cleaners available on the Platform.</p>
              <p>Only Clients who have completed a booking through the Platform may submit a review for that booking.</p>
            </SubSection>

            <SubSection number="9.2" title="Rating System">
              <p>Reviews may include a rating based on a five-star scale.</p>
              <p>Ratings and written reviews submitted by Clients may be displayed on the Cleaner\u2019s profile within the Platform.</p>
              <p>Ratings are intended to reflect the individual Client\u2019s experience and opinion regarding the completed booking.</p>
            </SubSection>

            <SubSection number="9.3" title="Timing of Reviews">
              <p>Reviews may only be submitted following the completion of a booking.</p>
              <p>Once a review has been submitted, it cannot be edited or modified by the Client.</p>
            </SubSection>

            <SubSection number="9.4" title="Cleaner Responses">
              <p>Cleaners may submit a single public response to a Client review.</p>
              <p>Cleaner responses are intended to allow Cleaners to provide clarification or context regarding a review.</p>
              <p>Cleaner responses may not be edited once submitted and additional reply chains are not permitted.</p>
              <p>MaidHive may remove or moderate responses that violate Platform rules.</p>
            </SubSection>

            <SubSection number="9.5" title="Review Moderation">
              <p>MaidHive may review, moderate or remove reviews or responses that:</p>
              <BulletList items={[
                'contain abusive, offensive or discriminatory language;',
                'include false or misleading statements;',
                'disclose personal contact details or private information;',
                'are unrelated to the relevant booking; or',
                'otherwise violate these Terms or Platform rules.',
              ]} />
              <p>MaidHive may also remove reviews where required to comply with applicable law.</p>
            </SubSection>

            <SubSection number="9.6" title="Authenticity of Reviews">
              <p>Users must not submit reviews that are knowingly false, misleading or fraudulent.</p>
              <p>Users must not attempt to manipulate ratings or reviews through coordinated activity, multiple accounts, or other deceptive practices.</p>
              <p>MaidHive may take enforcement action, including removal of reviews or suspension of accounts, where it reasonably believes that review manipulation has occurred.</p>
            </SubSection>

            <SubSection number="9.7" title="Informational Nature of Reviews">
              <p>Reviews and ratings reflect the opinions of individual Clients and do not constitute endorsements or guarantees by MaidHive.</p>
              <p>Clients remain responsible for evaluating whether a Cleaner is suitable for their needs before making a booking.</p>
            </SubSection>
          </Section>

          {/* ─── Section 10 ─── */}
          <Section number="10" title="Privacy and Data Use">
            <SubSection number="10.1" title="Collection and Processing of Personal Data">
              <p>MaidHive collects and processes personal data in connection with the operation of the Platform and the provision of services to users.</p>
              <p>Such personal data may include information provided during account registration, booking activity, communications between users, identity verification processes, payment processing, customer support interactions and other information necessary to operate the Platform.</p>
              <p>MaidHive processes personal data in accordance with applicable data protection laws, including the General Data Protection Regulation (GDPR) and the laws of the Republic of Cyprus.</p>
            </SubSection>

            <SubSection number="10.2" title="Identity Verification and Trust Measures">
              <p>In order to maintain trust and safety on the Platform, MaidHive may process identity verification information provided by users.</p>
              <p>This may include government-issued identification documents, verification data, right-to-work confirmations, or other information required during the Cleaner onboarding process or optional verification processes for Clients.</p>
              <p>Such information may be used for identity verification, platform integrity, trust and safety monitoring, fraud prevention and compliance purposes.</p>
            </SubSection>

            <SubSection number="10.3" title="Booking Communications and User Content">
              <p>In connection with bookings made through the Platform, MaidHive may process communications exchanged between users.</p>
              <p>This may include:</p>
              <BulletList items={[
                'messages sent through the Platform;',
                'booking notes or service instructions;',
                'photos or other content uploaded by users; and',
                'communications with MaidHive support services.',
              ]} />
              <p>Such information may be used for operational purposes, dispute resolution, customer support and enforcement of Platform rules.</p>
            </SubSection>

            <SubSection number="10.4" title="Location and Booking Verification Data">
              <p>Where relevant to the operation of a booking, MaidHive may process limited location-related data associated with the use of certain Platform features.</p>
              <p>For example, location data may be processed when Cleaners use the Platform\u2019s booking status functions, such as confirming arrival at the booking location.</p>
              <p>Such data is used solely for booking verification, operational integrity and dispute resolution purposes. Location data is limited to approximate location data necessary for booking verification and is not used for continuous or real-time tracking of users.</p>
            </SubSection>

            <SubSection number="10.5" title="Payment Processing">
              <p>Payments made through the Platform are processed by third-party payment processors.</p>
              <p>MaidHive may use services provided by Stripe or other authorised payment providers in order to process transactions.</p>
              <p>MaidHive does not store full payment card details. Payment information is processed and stored by the relevant payment processor in accordance with their own security and compliance standards.</p>
            </SubSection>

            <SubSection number="10.6" title="Platform Safety and Fraud Prevention">
              <p>MaidHive may process user data for purposes related to maintaining the safety and integrity of the Platform.</p>
              <p>Such purposes may include:</p>
              <BulletList items={[
                'fraud detection and prevention;',
                'investigation of suspicious or abusive activity;',
                'enforcement of these Terms and Platform policies;',
                'dispute investigation and resolution; and',
                'protection of users and the Platform from misuse.',
              ]} />
            </SubSection>

            <SubSection number="10.7" title="Data Retention">
              <p>MaidHive may retain personal data for as long as reasonably necessary to fulfil the purposes for which it was collected, including operational, legal, regulatory, security and dispute resolution purposes.</p>
              <p>Retention periods may vary depending on the nature of the information and applicable legal requirements.</p>
            </SubSection>

            <SubSection number="10.8" title="Privacy Policy">
              <p>Further information regarding how MaidHive collects, uses, stores and protects personal data is provided in the MaidHive Privacy Policy.</p>
              <p>The Privacy Policy forms an integral part of these Terms and should be read together with these Terms.</p>
            </SubSection>

            <SubSection number="10.9" title="Platform Communications">
              <p>By creating an account and using the Platform, users agree that MaidHive may send communications necessary for the operation of the Platform.</p>
              <p>Such communications may include:</p>
              <BulletList items={[
                'booking confirmations and updates;',
                'payment notifications;',
                'dispute and support communications;',
                'security alerts; and',
                'other service-related messages.',
              ]} />
              <p>These communications may be delivered through the Platform, email, SMS or other contact methods provided by the user.</p>
            </SubSection>

            <SubSection number="10.10" title="Marketing Communications">
              <p>Where permitted by applicable law, MaidHive may also send users marketing or promotional communications relating to the Platform, new features, updates or other relevant information.</p>
              <p>Users may opt out of receiving marketing communications at any time by using the unsubscribe options provided in such communications or by adjusting their account preferences where available.</p>
              <p>Service-related communications relating to bookings, payments, disputes or security may still be sent where necessary for the operation of the Platform.</p>
            </SubSection>
          </Section>

          {/* ─── Section 11 ─── */}
          <Section number="11" title="Limitation of Liability">
            <SubSection number="11.1" title="Platform Role and Independent Services">
              <p>MaidHive operates solely as a technology platform that facilitates connections between Clients and independent Cleaners.</p>
              <p>Cleaning services are provided directly by independent Cleaners and not by MaidHive.</p>
              <p>To the fullest extent permitted by applicable law, MaidHive shall not be liable for the acts, omissions, conduct, quality of work, safety, legality or performance of services provided by independent Cleaners.</p>
              <p>MaidHive\u2019s role is limited to providing the Platform and facilitating payments and dispute processes as described in these Terms.</p>
            </SubSection>

            <SubSection number="11.2" title="No Liability for Property Damage or Loss">
              <p>MaidHive does not provide insurance coverage for services performed through the Platform.</p>
              <p>To the fullest extent permitted by applicable law, MaidHive shall not be liable for any property damage, theft, personal loss or other damages arising from services performed by independent Cleaners.</p>
              <p>Any such claims or disputes relating to property damage, loss or theft must be resolved directly between the Client and the Cleaner, subject to the dispute reporting procedures set out in Section 8.</p>
            </SubSection>

            <SubSection number="11.3" title="Informational Nature of Platform Content">
              <p>Information displayed on the Platform, including Cleaner profiles, reviews, ratings, badges, verification indicators, job counts or other trust signals, is provided for informational purposes only.</p>
              <p>Users acknowledge that they rely on such information at their own discretion and risk when selecting a Cleaner through the Platform.</p>
              <p>The presence of such information does not constitute a recommendation, endorsement or guarantee by MaidHive regarding the suitability or reliability of any Cleaner.</p>
            </SubSection>

            <SubSection number="11.4" title="Platform Availability">
              <p>MaidHive does not guarantee that the Platform will be available at all times or that it will operate without interruption, delay, errors or technical issues.</p>
              <p>To the fullest extent permitted by applicable law, MaidHive shall not be liable for losses arising from temporary unavailability of the Platform, system errors, technical interruptions or other operational disruptions.</p>
            </SubSection>

            <SubSection number="11.5" title="Exclusion of Indirect or Consequential Losses">
              <p>To the fullest extent permitted by applicable law, MaidHive shall not be liable for any indirect, incidental, consequential or special damages arising out of or in connection with the use of the Platform.</p>
              <p>This includes, without limitation, losses relating to:</p>
              <BulletList items={[
                'loss of income or profits;',
                'business interruption;',
                'loss of business opportunities;',
                'reputational damage; or',
                'other economic losses.',
              ]} />
            </SubSection>

            <SubSection number="11.6" title="Limitation of Liability">
              <p>To the fullest extent permitted by applicable law, MaidHive\u2019s total liability to any user arising out of or in connection with the use of the Platform shall not exceed the total Platform Service Fees paid by that user to MaidHive during the twelve (12) months preceding the event giving rise to the claim.</p>
            </SubSection>

            <SubSection number="11.7" title="Gross Negligence and Wilful Misconduct">
              <p>Nothing in these Terms shall exclude or limit MaidHive\u2019s liability for losses arising from MaidHive\u2019s gross negligence, wilful misconduct or fraudulent actions.</p>
            </SubSection>

            <SubSection number="11.8" title="Non-Excludable Liability">
              <p>Nothing in these Terms shall exclude or limit liability where such limitation or exclusion is not permitted under applicable law.</p>
              <p>This includes, without limitation, liability relating to fraud, death or personal injury caused by negligence, or rights that cannot be excluded under applicable consumer protection laws of the Republic of Cyprus or the European Union.</p>
            </SubSection>
          </Section>

          {/* ─── Section 12 ─── */}
          <Section number="12" title="Suspension and Termination">
            <SubSection number="12.1" title="Platform Enforcement Rights">
              <p>MaidHive reserves the right to suspend, restrict or terminate user accounts where it reasonably believes that a user has violated these Terms, applicable Platform rules or applicable laws.</p>
              <p>Such enforcement actions may apply to both Clients and Cleaners.</p>
              <p>MaidHive may also take enforcement action where it reasonably believes that such action is necessary to protect the safety, integrity or proper operation of the Platform.</p>
            </SubSection>

            <SubSection number="12.2" title="Temporary Suspension">
              <p>MaidHive may temporarily suspend a user account while investigating potential violations of these Terms or reports of unsafe, fraudulent or abusive behaviour.</p>
              <p>During a suspension, the user may be unable to access certain features of the Platform, including the ability to create new bookings, accept booking requests or communicate with other users through the Platform.</p>
              <p>Suspension may remain in effect until MaidHive completes its review and determines whether further enforcement action is required.</p>
            </SubSection>

            <SubSection number="12.3" title="Immediate Suspension for Safety">
              <p>MaidHive may immediately suspend a user account without prior notice where it reasonably believes that such action is necessary to:</p>
              <BulletList items={[
                'protect the safety of other users;',
                'prevent fraud or misuse of the Platform;',
                'address suspected abusive or threatening behaviour; or',
                'protect the security or integrity of the Platform.',
              ]} />
              <p>Where appropriate, MaidHive may subsequently review the circumstances and determine whether to reinstate the account or proceed with termination.</p>
            </SubSection>

            <SubSection number="12.4" title="Account Termination">
              <p>MaidHive may permanently terminate a user account where it determines that a user has committed serious or repeated violations of these Terms or where continued use of the Platform presents a risk to other users or to the Platform itself.</p>
              <p>Upon termination, the user\u2019s access to the Platform may be permanently disabled and the user may be prevented from creating new accounts.</p>
            </SubSection>

            <SubSection number="12.5" title="Removal of Content">
              <p>MaidHive may remove or restrict content posted or transmitted through the Platform where such content violates these Terms, Platform policies or applicable laws.</p>
              <p>This may include, without limitation:</p>
              <BulletList items={[
                'user profile descriptions;',
                'images or other uploaded media;',
                'reviews or responses;',
                'messages or other communications; or',
                'any other content that MaidHive determines to be inappropriate or harmful.',
              ]} />
            </SubSection>

            <SubSection number="12.6" title="Effect on Existing Bookings">
              <p>Where a user account is suspended or terminated, MaidHive may cancel any upcoming bookings associated with that account where it determines that cancellation is necessary for safety, operational or compliance reasons.</p>
              <p>Where bookings are cancelled as a result of account suspension or termination, refunds may be issued or payments adjusted in accordance with the applicable provisions of these Terms.</p>
            </SubSection>

            <SubSection number="12.7" title="Completed Bookings and Pending Payments">
              <p>Termination or suspension of a user account does not automatically affect bookings that have already been completed.</p>
              <p>Where a booking has been completed prior to account suspension or termination, any payments, refunds or payouts relating to that booking may continue to be processed in accordance with these Terms, unless MaidHive reasonably suspects fraud or misuse of the Platform.</p>
            </SubSection>
          </Section>

          {/* ─── Section 13 ─── */}
          <Section number="13" title="Changes to the Terms">
            <SubSection number="13.1" title="Right to Update the Terms">
              <p>MaidHive may update or modify these Terms from time to time in order to reflect changes to the Platform, legal or regulatory requirements, security considerations, or improvements to the services offered through the Platform.</p>
            </SubSection>

            <SubSection number="13.2" title="Notification of Changes">
              <p>Where MaidHive makes material changes to these Terms, MaidHive will take reasonable steps to notify users of the updated Terms.</p>
              <p>Such notification may be provided through one or more of the following methods:</p>
              <BulletList items={[
                'email notifications sent to the email address associated with the user\u2019s account;',
                'notifications displayed within the Platform; or',
                'publication of the updated Terms on the Platform.',
              ]} />
            </SubSection>

            <SubSection number="13.3" title="Effective Date of Updated Terms">
              <p>Material updates to these Terms will generally become effective fourteen (14) days after the updated Terms are published or users are notified, unless a different effective date is specified.</p>
              <p>Where changes are required to comply with applicable law, address security issues or prevent fraud or abuse, MaidHive may implement such changes with immediate effect where reasonably necessary.</p>
            </SubSection>

            <SubSection number="13.4" title="Acceptance of Updated Terms">
              <p>By continuing to access or use the Platform after updated Terms become effective, users agree to be bound by the revised Terms.</p>
              <p>If a user does not agree with the updated Terms, they must stop using the Platform and may request closure of their account.</p>
            </SubSection>
          </Section>

          {/* ─── Section 14 ─── */}
          <Section number="14" title="Governing Law and Jurisdiction">
            <SubSection number="14.1" title="Governing Law">
              <p>These Terms and any contractual or non-contractual obligations arising out of or in connection with them shall be governed by and interpreted in accordance with the laws of the Republic of Cyprus.</p>
            </SubSection>

            <SubSection number="14.2" title="Jurisdiction">
              <p>Subject to applicable consumer protection laws, the courts of the Republic of Cyprus shall have jurisdiction to resolve any disputes arising out of or relating to these Terms or the use of the Platform.</p>
            </SubSection>

            <SubSection number="14.3" title="Consumer Rights">
              <p>Nothing in these Terms shall limit or exclude any rights that users may have under applicable consumer protection laws of the Republic of Cyprus or the European Union.</p>
              <p>Where mandatory consumer protection laws provide users with rights that differ from the provisions of these Terms, those rights shall prevail to the extent required by law.</p>
            </SubSection>
          </Section>

          {/* ─── Section 15 ─── */}
          <Section number="15" title="Consumer Rights and Severability">
            <SubSection number="15.1" title="Consumer Rights">
              <p>Nothing in these Terms shall limit, exclude, or restrict any rights that users may have under applicable consumer protection laws of the Republic of Cyprus or the European Union.</p>
              <p>Where mandatory consumer protection laws grant users rights that are more favourable than the provisions contained in these Terms, those statutory rights shall prevail to the extent required by law.</p>
            </SubSection>

            <SubSection number="15.2" title="Severability">
              <p>If any provision of these Terms is held to be invalid, unlawful, or unenforceable by a court or competent authority, that provision shall be deemed severed from the remaining Terms.</p>
              <p>The remainder of the Terms shall remain valid and enforceable to the fullest extent permitted by law.</p>
            </SubSection>
          </Section>

          {/* ─── Section 16 ─── */}
          <Section number="16" title="Force Majeure">
            <p>MaidHive shall not be liable for any delay or failure to perform its obligations under these Terms where such delay or failure results from events beyond its reasonable control, including but not limited to natural disasters, internet outages, power failures, government actions, labour disputes, or other events commonly referred to as force majeure.</p>
          </Section>

          {/* ─── Section 17 ─── */}
          <Section number="17" title="Assignment">
            <p>MaidHive may assign or transfer its rights and obligations under these Terms to an affiliated entity or as part of a merger, acquisition, restructuring or sale of assets, provided that such transfer does not reduce the protections afforded to users under these Terms.</p>
            <p>Users may not assign or transfer their rights or obligations under these Terms without the prior written consent of MaidHive.</p>
          </Section>

          {/* ─── Section 18 ─── */}
          <Section number="18" title="Entire Agreement">
            <p>These Terms, together with any policies referenced within them (including the Privacy Policy), constitute the entire agreement between the user and MaidHive regarding the use of the Platform and supersede any prior agreements, communications or understandings.</p>
          </Section>

          {/* ─── Section 19 ─── */}
          <Section number="19" title="Contact Information">
            <p>If you have questions regarding these Terms or the operation of the Platform, you may contact:</p>
            <div className="bg-gray-50 rounded-xl p-6 mt-4">
              <p className="font-semibold text-gray-900 mb-1">MaidHive Ltd.</p>
              <p>Email: <a href="mailto:support@maidhive.app" className="text-primary hover:underline">support@maidhive.app</a></p>
              <p className="mt-2">Additional contact information may be made available through the Platform.</p>
            </div>
          </Section>

        </div>
      </div>
    </>
  )
}

/* ─── Helper components ─── */

function Section({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mb-16">
      <div className="flex items-baseline gap-3 mb-6 pb-4 border-b border-gray-100">
        <span className="text-sm font-mono text-primary font-semibold">{number}.</span>
        <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
      </div>
      <div className="space-y-4 text-[15px] text-gray-600 leading-relaxed">{children}</div>
    </section>
  )
}

function SubSection({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <div className="mt-8 first:mt-0">
      <h3 className="text-base font-semibold text-gray-800 mb-3">
        <span className="text-primary/70 font-mono text-sm mr-2">{number}</span>
        {title}
      </h3>
      <div className="space-y-3 pl-0">{children}</div>
    </div>
  )
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc pl-6 space-y-1.5 my-3">
      {items.map((item, i) => (
        <li key={i} className="text-gray-600">{item}</li>
      ))}
    </ul>
  )
}

function DefinitionList({ definitions }: { definitions: [string, string][] }) {
  return (
    <dl className="space-y-3 my-4">
      {definitions.map(([term, desc]) => (
        <div key={term} className="flex flex-col sm:flex-row sm:gap-2">
          <dt className="font-semibold text-gray-800 shrink-0">{term}</dt>
          <dd className="text-gray-600">{desc}</dd>
        </div>
      ))}
    </dl>
  )
}
