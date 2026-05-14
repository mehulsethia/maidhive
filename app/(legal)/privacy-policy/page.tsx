import type { Metadata } from 'next'

export const dynamic = 'force-static'
export const revalidate = false

export const metadata: Metadata = {
  title: 'Privacy Policy — MaidHive',
  description: 'Learn how MaidHive collects, uses, and protects your personal data.',
}

export default function PrivacyPage() {
  return (
    <>
      {/* Header */}
      <div className="bg-gray-950 px-6 py-20 text-center">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">Privacy Policy</h1>
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
              This Privacy Policy explains how MaidHive collects, uses, stores, and protects personal data in connection with your use of the MaidHive platform, including our website, applications, and related services.
            </p>
            <p>
              MaidHive is committed to protecting user privacy and processing personal data in accordance with applicable data protection laws, including the General Data Protection Regulation (GDPR).
            </p>
          </div>

          {/* ─── Section 1 ─── */}
          <Section number="1" title="Information We Collect">
            <p>MaidHive collects and processes certain personal data in order to operate the Platform, facilitate bookings between Clients and Cleaners, process payments, maintain platform safety, and comply with legal obligations.</p>
            <p>The categories of personal data collected depend on how you interact with the Platform.</p>

            <SubSection number="1.1" title="Account Information">
              <p>When users create an account on the Platform, MaidHive collects information necessary to establish and manage the account.</p>
              <p>This may include:</p>
              <BulletList items={[
                'full name',
                'email address',
                'phone number',
                'password and authentication credentials',
                'profile photo (if provided)',
                'account role (Client or Cleaner).',
              ]} />
              <p>This information is used to create user accounts, enable authentication, and allow users to access and manage their profiles.</p>
            </SubSection>

            <SubSection number="1.2" title="Profile and Service Information">
              <p>Users may provide additional information to personalise their profiles or enable service functionality on the Platform.</p>
              <p>For Cleaners, this may include:</p>
              <BulletList items={[
                'service description and profile information',
                'hourly rate and availability settings',
                'service preferences and skills',
                'profile photo.',
              ]} />
              <p>For Clients, this may include:</p>
              <BulletList items={[
                'service preferences',
                'saved addresses for service locations',
                'notes or instructions relating to bookings.',
              ]} />
              <p>Certain profile information provided by Cleaners may be visible to Clients when browsing available service providers.</p>
            </SubSection>

            <SubSection number="1.3" title="Booking and Transaction Information">
              <p>When a booking is created or managed through the Platform, MaidHive collects information required to facilitate the service and manage the transaction.</p>
              <p>This may include:</p>
              <BulletList items={[
                'booking date and time',
                'service duration',
                'booking address',
                'booking notes or instructions',
                'booking status information',
                'pricing information and service subtotal.',
              ]} />
              <p>Booking records may also include system-generated timestamps relating to booking creation, acceptance, service completion, and payment processing.</p>
            </SubSection>

            <SubSection number="1.4" title="Identity Verification Information (Cleaners)">
              <p>Cleaners may be required to provide identity verification documentation as part of the platform onboarding or approval process.</p>
              <p>This may include:</p>
              <BulletList items={[
                'government-issued identification documents (such as passport, national ID card, or driver\u2019s licence)',
                'right-to-work confirmations where applicable.',
              ]} />
              <p>These documents are stored securely within MaidHive\u2019s infrastructure and are accessible only to authorised administrators for the purpose of verifying identity and maintaining platform safety.</p>
            </SubSection>

            <SubSection number="1.5" title="Communications and Messaging">
              <p>The Platform may allow Clients and Cleaners to communicate through in-platform messaging features in connection with confirmed bookings.</p>
              <p>MaidHive may collect and store:</p>
              <BulletList items={[
                'messages exchanged between users through the Platform',
                'support communications sent to MaidHive',
                'communications relating to bookings or disputes.',
              ]} />
              <p>These communications may be reviewed where necessary to:</p>
              <BulletList items={[
                'investigate disputes',
                'provide customer support',
                'enforce platform policies',
                'maintain platform safety.',
              ]} />
            </SubSection>

            <SubSection number="1.6" title="Dispute Reports and Evidence">
              <p>If a user submits a dispute or reports a problem relating to a booking, MaidHive may collect additional information necessary to review the issue.</p>
              <p>This may include:</p>
              <BulletList items={[
                'written descriptions of the reported issue',
                'photographs or other evidence uploaded by users',
                'related booking information and system records.',
              ]} />
              <p>This information is used solely for investigating and resolving disputes.</p>
            </SubSection>

            <SubSection number="1.7" title="Location Verification Data">
              <p>When a Cleaner confirms arrival at a booking using the Platform, the system may record:</p>
              <BulletList items={[
                'a timestamp of the action',
                'an approximate location within a limited radius of the booking address.',
              ]} />
              <p>This information is used for:</p>
              <BulletList items={[
                'arrival verification',
                'performance metrics',
                'dispute resolution.',
              ]} />
              <p>Location data is not used for continuous tracking or background monitoring.</p>
            </SubSection>

            <SubSection number="1.8" title="Device and Usage Information">
              <p>When users access the Platform, certain technical information may be collected automatically.</p>
              <p>This may include:</p>
              <BulletList items={[
                'IP address',
                'device type',
                'operating system',
                'browser type',
                'session activity',
                'pages visited and interaction timestamps.',
              ]} />
              <p>This information helps MaidHive maintain platform functionality, detect abuse, and improve platform performance.</p>
            </SubSection>

            <SubSection number="1.9" title="Cookies and Similar Technologies">
              <p>The Platform may use cookies and similar technologies to:</p>
              <BulletList items={[
                'maintain secure user sessions',
                'remember user preferences',
                'support analytics and performance monitoring.',
              ]} />
              <p>Further information about the use of cookies and user choices is provided in Section 5 (Cookies and Tracking Technologies).</p>
            </SubSection>
          </Section>

          {/* ─── Section 2 ─── */}
          <Section number="2" title="Legal Basis for Processing (GDPR Article 6)">
            <p>Under the General Data Protection Regulation (GDPR), MaidHive processes personal data only where a valid legal basis exists. The legal bases relied upon by MaidHive depend on the nature of the data being processed and the context in which it is collected.</p>
            <p>MaidHive primarily relies on the following legal bases: contract performance, legitimate interests, legal obligations, and user consent.</p>

            <SubSection number="2.1" title="Performance of a Contract">
              <p>MaidHive processes personal data where necessary to provide the services requested by users and to operate the Platform.</p>
              <p>This includes processing necessary to:</p>
              <BulletList items={[
                'create and manage user accounts',
                'facilitate bookings between Clients and Cleaners',
                'process service scheduling and booking confirmations',
                'enable communication between Clients and Cleaners for confirmed bookings',
                'process payments, refunds, and payouts through payment processors',
                'maintain booking records and service history.',
              ]} />
              <p>Without processing this information, MaidHive would not be able to operate the marketplace services requested by users.</p>
            </SubSection>

            <SubSection number="2.2" title="Legitimate Interests">
              <p>MaidHive may process personal data where necessary for the legitimate interests of operating, protecting, and improving the Platform, provided such interests are not overridden by users\u2019 data protection rights.</p>
              <p>These legitimate interests include:</p>
              <BulletList items={[
                'maintaining platform safety and trust between users',
                'verifying the identity of Cleaners during onboarding',
                'detecting and preventing fraud, abuse, or policy violations',
                'monitoring booking activity to prevent misuse of the Platform',
                'verifying service attendance and arrival timing for bookings',
                'investigating disputes and reviewing submitted evidence',
                'maintaining platform security and preventing unauthorised activity',
                'improving platform functionality and user experience.',
              ]} />
              <p>Where possible, MaidHive takes steps to minimise the amount of personal data processed for these purposes.</p>
              <p>MaidHive processes only the minimum amount of personal data necessary to achieve the purposes described in this Privacy Policy.</p>
            </SubSection>

            <SubSection number="2.3" title="Compliance with Legal Obligations">
              <p>Certain personal data may be processed where necessary for MaidHive to comply with applicable legal or regulatory obligations.</p>
              <p>This may include processing required to:</p>
              <BulletList items={[
                'comply with tax and financial reporting requirements',
                'maintain accounting and transaction records',
                'respond to lawful requests from regulators or law enforcement authorities',
                'comply with court orders or legal proceedings',
                'enforce legal rights and obligations.',
              ]} />
              <p>Personal data may be retained for the duration required by applicable laws governing financial records and business operations.</p>
            </SubSection>

            <SubSection number="2.4" title="User Consent">
              <p>In certain circumstances, MaidHive relies on user consent to process personal data.</p>
              <p>This includes:</p>
              <BulletList items={[
                'sending marketing communications or promotional updates',
                'optional cookies or analytics tracking where consent is required.',
              ]} />
              <p>Users who opt in to receive marketing communications may withdraw their consent at any time by using the unsubscribe link provided in marketing emails or adjusting their account settings.</p>
              <p>Withdrawal of consent will not affect the lawfulness of processing carried out before consent was withdrawn.</p>
            </SubSection>

            <SubSection number="2.5" title="Service Communications">
              <p>Certain communications sent through the Platform are necessary for the operation of the service and are therefore processed under the legal basis of contract performance.</p>
              <p>These communications may include:</p>
              <BulletList items={[
                'booking confirmations',
                'booking updates and reminders',
                'dispute notifications',
                'account security alerts',
                'important platform notices.',
              ]} />
              <p>Users cannot opt out of receiving these service-related communications while maintaining an active account, as they are required for the proper functioning of the Platform.</p>
            </SubSection>
          </Section>

          {/* ─── Section 3 ─── */}
          <Section number="3" title="How We Use Your Information">
            <p>MaidHive uses personal data to operate, maintain, and improve the Platform and to facilitate the services provided between Clients and Cleaners.</p>
            <p>The purposes for which personal data is processed depend on how users interact with the Platform and the services they request.</p>

            <SubSection number="3.1" title="Providing and Operating the Platform">
              <p>MaidHive processes personal data to operate the marketplace services and allow users to access and use the Platform.</p>
              <p>This includes processing necessary to:</p>
              <BulletList items={[
                'create and manage user accounts',
                'enable users to log in and manage their profiles',
                'display Cleaner profiles to Clients',
                'allow Clients to browse and select Cleaners',
                'enable booking requests and service scheduling',
                'store booking details and service history.',
              ]} />
              <p>Without this processing, MaidHive would not be able to provide the platform services requested by users.</p>
            </SubSection>

            <SubSection number="3.2" title="Facilitating Bookings Between Clients and Cleaners">
              <p>Personal data is used to enable and manage service bookings between Clients and Cleaners.</p>
              <p>This includes processing necessary to:</p>
              <BulletList items={[
                'create booking requests and booking confirmations',
                'record booking details such as service duration, time, and location',
                'share limited information between Clients and Cleaners for confirmed bookings',
                'allow communication between users in connection with bookings',
                'coordinate service delivery.',
              ]} />
              <p>Clients choose a Cleaner and submit a booking request through the Platform. MaidHive does not automatically assign service providers.</p>
            </SubSection>

            <SubSection number="3.3" title="Payment Processing and Financial Administration">
              <p>MaidHive processes certain personal and transactional data to facilitate payments and manage financial records associated with bookings.</p>
              <p>This includes processing necessary to:</p>
              <BulletList items={[
                'authorise payments at the time a booking request is submitted',
                'capture payments following booking completion',
                'process cancellation charges where applicable',
                'issue refunds where required',
                'maintain payment records and transaction history',
                'manage payouts to Cleaners through third-party payment processors.',
              ]} />
              <p>Payment processing is performed through secure third-party payment providers such as Stripe. MaidHive does not store full payment card numbers.</p>
            </SubSection>

            <SubSection number="3.4" title="Platform Safety, Trust, and Verification">
              <p>MaidHive processes personal data to maintain trust and safety on the Platform.</p>
              <p>This includes processing necessary to:</p>
              <BulletList items={[
                'verify Cleaner identity documentation during onboarding',
                'detect and prevent fraudulent or abusive activity',
                'monitor compliance with platform policies',
                'investigate suspicious behaviour or misuse of the Platform',
                'apply warnings, suspensions, or other enforcement actions where appropriate.',
              ]} />
              <p>These measures are designed to maintain a safe and reliable marketplace for all users.</p>
            </SubSection>

            <SubSection number="3.5" title="Dispute Investigation and Resolution">
              <p>Where a dispute or issue is reported relating to a booking, MaidHive may process relevant personal data in order to review and resolve the matter.</p>
              <p>This may include:</p>
              <BulletList items={[
                'reviewing booking records and timestamps',
                'analysing messages exchanged between users',
                'evaluating evidence submitted by users',
                'reviewing service completion information',
                'determining appropriate dispute outcomes.',
              ]} />
              <p>Platform system records may be used as part of the dispute review process.</p>
            </SubSection>

            <SubSection number="3.6" title="Performance Metrics and Platform Reputation Systems">
              <p>MaidHive may use certain booking and performance data to maintain reputation systems and performance indicators on the Platform.</p>
              <p>This may include:</p>
              <BulletList items={[
                'calculating cleaner ratings and review scores',
                'displaying total completed bookings',
                'calculating on-time arrival metrics',
                'determining eligibility for platform recognition indicators such as performance badges.',
              ]} />
              <p>These metrics help Clients make informed booking decisions and help maintain service quality on the Platform.</p>
            </SubSection>

            <SubSection number="3.7" title="Customer Support and Account Assistance">
              <p>Personal data may be used by MaidHive support personnel to assist users with platform-related issues.</p>
              <p>This may include:</p>
              <BulletList items={[
                'responding to support requests',
                'investigating booking issues',
                'assisting with account access or technical issues',
                'reviewing relevant booking or communication records when necessary.',
              ]} />
              <p>Access to such data is limited to authorised personnel for support purposes.</p>
            </SubSection>

            <SubSection number="3.8" title="Platform Improvements and Analytics">
              <p>MaidHive may analyse aggregated or anonymised usage information in order to improve the Platform.</p>
              <p>This may include:</p>
              <BulletList items={[
                'monitoring how users interact with platform features',
                'identifying technical issues or performance problems',
                'improving platform design, functionality, and user experience',
                'developing new features and services.',
              ]} />
              <p>Where possible, MaidHive uses aggregated or anonymised data for these purposes.</p>
            </SubSection>

            <SubSection number="3.9" title="Communications and Notifications">
              <p>MaidHive may send communications to users relating to their use of the Platform.</p>
              <p>These communications may include:</p>
              <BulletList items={[
                'booking confirmations and updates',
                'booking reminders',
                'dispute notifications',
                'account security alerts',
                'important platform notices',
                'optional marketing communications (where users have provided consent).',
              ]} />
              <p>Notifications may be delivered through email, in-platform messaging, or push notifications where supported by the user\u2019s device.</p>
            </SubSection>
          </Section>

          {/* ─── Section 4 ─── */}
          <Section number="4" title="How We Share Information">
            <p>MaidHive does not sell or rent users\u2019 personal data to third parties. Personal information may only be shared in limited circumstances necessary to operate the Platform and provide the services requested by users.</p>

            <SubSection number="4.1" title="Sharing Between Clients and Cleaners">
              <p>When a booking is created and accepted through the Platform, certain information must be shared between the Client and the Cleaner in order to coordinate the service.</p>
              <p>For confirmed bookings, the Cleaner may receive limited information about the Client, including:</p>
              <BulletList items={[
                'the Client\u2019s first name or display name',
                'booking details such as date, time, and service duration',
                'the service location address',
                'booking notes or instructions provided by the Client',
                'the ability to communicate with the Client through the Platform.',
              ]} />
              <p>Prior to booking acceptance, Cleaners may see only limited booking information necessary to evaluate the request, such as the booking date, service duration, general notes, and an approximate location of the service area. The exact address and apartment or unit details are only provided after a booking has been accepted.</p>
              <p>Clients may also view information about Cleaners in order to select a service provider. This may include:</p>
              <BulletList items={[
                'cleaner name',
                'profile photo',
                'service description',
                'hourly rate',
                'star ratings and written reviews',
                'completed booking count',
                'performance indicators such as on-time metrics where applicable.',
              ]} />
              <p>Email addresses and payment information are not shared between users.</p>
            </SubSection>

            <SubSection number="4.2" title="Contact Information for Booking Coordination">
              <p>Where necessary to coordinate a confirmed booking, certain contact information may be made available between the Client and the Cleaner.</p>
              <p>For example, phone numbers may be revealed through the Platform shortly before a scheduled booking or in accordance with platform communication rules.</p>
              <p>Contact information shared in this manner is intended solely for coordinating the service and should not be used for unrelated purposes.</p>
              <p>MaidHive does not permit the use of contact information for purposes outside the Platform, including attempting to bypass platform payments or services.</p>
            </SubSection>

            <SubSection number="4.3" title="Service Providers and Platform Infrastructure">
              <p>MaidHive may share personal data with trusted third-party service providers that assist in operating the Platform.</p>
              <p>These providers may include:</p>
              <BulletList items={[
                'payment processors that handle payment authorisation, capture, and payouts',
                'cloud hosting providers that operate the servers and infrastructure used by the Platform',
                'secure file storage services used for storing verification documents',
                'analytics and performance monitoring tools used to improve the Platform',
                'email or communication services used to deliver platform notifications.',
              ]} />
              <p>These service providers process data only on behalf of MaidHive and are required to implement appropriate data protection safeguards.</p>
            </SubSection>

            <SubSection number="4.4" title="Legal Requirements and Protection of Rights">
              <p>MaidHive may disclose personal data where required to do so by law or where disclosure is reasonably necessary to:</p>
              <BulletList items={[
                'comply with legal obligations',
                'respond to lawful requests from regulators, courts, or law enforcement authorities',
                'enforce MaidHive\u2019s Terms and platform policies',
                'protect the rights, property, or safety of MaidHive, its users, or the public.',
              ]} />
            </SubSection>

            <SubSection number="4.5" title="Business Transfers">
              <p>If MaidHive undergoes a business transaction such as a merger, acquisition, restructuring, or sale of assets, personal data held by the Platform may be transferred as part of that transaction.</p>
              <p>In such cases, MaidHive will take reasonable steps to ensure that personal data continues to be handled in accordance with this Privacy Policy.</p>
            </SubSection>

            <SubSection number="4.6" title="Internal Access and Administration">
              <p>Access to personal data within MaidHive is limited to authorised personnel who require such access in order to operate the Platform, provide customer support, review disputes, or enforce platform policies.</p>
              <p>MaidHive implements internal safeguards to ensure that personal data is accessed only where necessary and in accordance with applicable data protection laws.</p>
            </SubSection>
          </Section>

          {/* ─── Section 5 ─── */}
          <Section number="5" title="Cookies and Tracking Technologies">
            <p>MaidHive uses cookies and similar technologies to operate the Platform, maintain security, and improve user experience.</p>
            <p>Cookies are small data files stored on a user\u2019s device when visiting or using the Platform.</p>

            <SubSection number="5.1" title="Types of Cookies Used">
              <h4 className="text-sm font-semibold text-gray-900 mt-4 mb-2">Essential Cookies</h4>
              <p>Essential cookies are required for the basic operation of the Platform and cannot be disabled through the cookie preference system.</p>
              <p>These cookies may be used to:</p>
              <BulletList items={[
                'maintain user login sessions',
                'enable account authentication',
                'ensure platform security',
                'store temporary booking or session information',
                'support core platform functionality.',
              ]} />
              <p>Because these cookies are necessary for the operation of the Platform, they do not require user consent.</p>

              <h4 className="text-sm font-semibold text-gray-900 mt-6 mb-2">Analytics Cookies</h4>
              <p>Analytics cookies help MaidHive understand how users interact with the Platform so that performance and user experience can be improved.</p>
              <p>These cookies may be used to collect information such as:</p>
              <BulletList items={[
                'pages visited on the Platform',
                'interaction with platform features',
                'device and browser information',
                'session duration and navigation patterns.',
              ]} />
              <p>Analytics cookies are optional and will only be activated if users provide consent through the cookie consent banner.</p>
              <p>Users may withdraw or modify their consent at any time through the Platform\u2019s cookie preference settings.</p>
            </SubSection>

            <SubSection number="5.2" title="Cookie Consent and User Choices">
              <p>When users first visit the Platform, they may be presented with a cookie consent banner that allows them to:</p>
              <BulletList items={[
                'accept all cookies',
                'reject non-essential cookies',
                'manage cookie preferences.',
              ]} />
              <p>Essential cookies remain active because they are required for the operation of the Platform.</p>
              <p>Users may revisit and change their cookie preferences at any time through the Cookie Settings option available on the Platform.</p>
            </SubSection>

            <SubSection number="5.3" title="Managing Cookies">
              <p>Most web browsers allow users to manage or delete cookies through their browser settings.</p>
              <p>Users may configure their browser to block cookies or notify them when cookies are being used. However, disabling certain cookies may affect the functionality of the Platform, including login and booking features.</p>
            </SubSection>
          </Section>

          {/* ─── Section 6 ─── */}
          <Section number="6" title="Data Retention">
            <p>MaidHive retains personal data only for as long as necessary to provide the Platform, comply with legal obligations, resolve disputes, prevent fraud, and enforce its agreements.</p>
            <p>The retention period may vary depending on the type of information and the purpose for which it was collected.</p>

            <SubSection number="6.1" title="Account Information">
              <p>Account information such as names, email addresses, phone numbers, and profile information is retained while a user account remains active.</p>
              <p>If a user deletes their account, MaidHive will remove or anonymise the account profile within a reasonable period, except where certain data must be retained for legal compliance, dispute resolution, fraud prevention, or enforcement of platform policies.</p>
              <p>Deleted accounts will no longer be accessible and public profile visibility will be removed.</p>
            </SubSection>

            <SubSection number="6.2" title="Booking and Transaction Records">
              <p>Information relating to bookings, payments, cancellations, refunds, and payouts may be retained for a longer period where necessary to comply with accounting, tax, and financial reporting obligations.</p>
              <p>Such records may be retained for a period required under applicable accounting, tax, and financial reporting laws (which may extend to several years), even if the associated user account has been deleted.</p>
            </SubSection>

            <SubSection number="6.3" title="Dispute and Support Records">
              <p>Information relating to disputes, problem reports, communications with support, and evidence submitted through the Platform may be retained for a reasonable period in order to:</p>
              <BulletList items={[
                'review and resolve disputes',
                'investigate potential fraud or abuse',
                'respond to legal claims or chargebacks',
                'enforce the Platform\u2019s policies and Terms.',
              ]} />
            </SubSection>

            <SubSection number="6.4" title="Identity Verification Information (Cleaners)">
              <p>Identity verification documents submitted by Cleaners, such as government-issued identification, are stored securely and used solely for identity verification and compliance purposes.</p>
              <p>These documents are retained while the Cleaner account remains active and may be retained for a limited period following account deletion where necessary for fraud prevention or legal compliance.</p>
              <p>After this period, identity verification documents will be securely deleted.</p>
            </SubSection>

            <SubSection number="6.5" title="Messages and Communication Data">
              <p>Messages exchanged between Clients and Cleaners through the Platform may be retained for a limited period in order to:</p>
              <BulletList items={[
                'assist with dispute resolution',
                'provide customer support',
                'investigate fraud or misuse of the Platform.',
              ]} />
            </SubSection>

            <SubSection number="6.6" title="Analytics and Technical Data">
              <p>Technical logs and analytics data may be retained for operational and analytical purposes.</p>
              <p>Where possible, MaidHive may anonymise or aggregate older usage data so that it no longer identifies individual users while still allowing the Platform to analyse performance trends and improve the Service.</p>
            </SubSection>
          </Section>

          {/* ─── Section 7 ─── */}
          <Section number="7" title="Data Security">
            <p>MaidHive implements appropriate technical and organisational measures designed to protect personal data against unauthorised access, alteration, disclosure, or destruction.</p>
            <p>These safeguards are designed to maintain the confidentiality, integrity, and availability of user data processed through the Platform.</p>

            <SubSection number="7.1" title="Secure Platform Infrastructure">
              <p>The Platform uses industry-standard security technologies designed to protect information transmitted between users and the Platform.</p>
              <p>This includes the use of encrypted connections (HTTPS / SSL / TLS) to secure communications between users\u2019 devices and MaidHive\u2019s servers.</p>
            </SubSection>

            <SubSection number="7.2" title="Password Protection">
              <p>User passwords are not stored in plain text.</p>
              <p>Passwords are stored using secure cryptographic hashing methods designed to protect login credentials from unauthorised access.</p>
            </SubSection>

            <SubSection number="7.3" title="Access Controls">
              <p>Access to personal data is restricted to authorised personnel who require such access for legitimate operational purposes.</p>
              <p>Examples of authorised access may include:</p>
              <BulletList items={[
                'customer support assistance',
                'dispute investigation',
                'fraud prevention or abuse monitoring',
                'technical maintenance of the Platform.',
              ]} />
              <p>Personnel accessing such data are required to handle information in accordance with security and confidentiality obligations.</p>
            </SubSection>

            <SubSection number="7.4" title="Secure Storage of Sensitive Documents">
              <p>Sensitive documents submitted through the Platform, including identity verification documents provided by Cleaners, are stored using secure storage systems designed to prevent unauthorised access.</p>
              <p>Access to such documents is limited to authorised administrative personnel and used solely for verification, compliance, and fraud prevention purposes.</p>
            </SubSection>

            <SubSection number="7.5" title="Security Monitoring">
              <p>MaidHive may monitor the Platform for suspicious activity, security vulnerabilities, or misuse in order to protect the integrity of the Service and the safety of its users.</p>
            </SubSection>

            <SubSection number="7.6" title="Security Incident Response">
              <p>While MaidHive implements reasonable security safeguards, no system can guarantee absolute security.</p>
              <p>If a security incident or data breach occurs that is likely to result in a risk to users\u2019 rights or freedoms, MaidHive may investigate the incident and take appropriate action, including notifying affected users and relevant regulatory authorities where required by applicable law.</p>
            </SubSection>
          </Section>

          {/* ─── Section 8 ─── */}
          <Section number="8" title="Your Rights">
            <p>Under applicable data protection laws, including the General Data Protection Regulation (GDPR), users have certain rights regarding their personal data processed by MaidHive.</p>
            <p>These rights may include the following.</p>

            <SubSection number="8.1" title="Right of Access">
              <p>Users may request confirmation as to whether MaidHive processes their personal data and may request access to a copy of such information.</p>
              <p>Most personal information associated with an account may be viewed directly within the Platform\u2019s user dashboard. Additional information may be requested by contacting MaidHive using the contact details provided in this Privacy Policy.</p>
            </SubSection>

            <SubSection number="8.2" title="Right to Rectification">
              <p>Users have the right to request correction of inaccurate or incomplete personal data.</p>
              <p>Users may update certain account information directly through their account settings within the Platform.</p>
            </SubSection>

            <SubSection number="8.3" title="Right to Erasure (Right to be Forgotten)">
              <p>Users may request deletion of their account and associated personal data through the Platform\u2019s account settings.</p>
              <p>Upon deletion, the user account will be deactivated and the public profile removed. Certain information may be retained where necessary to comply with legal obligations, resolve disputes, prevent fraud, or enforce MaidHive\u2019s Terms and platform policies.</p>
            </SubSection>

            <SubSection number="8.4" title="Right to Restrict Processing">
              <p>In certain circumstances, users may request that MaidHive restrict the processing of their personal data.</p>
              <p>This may apply where the accuracy of the data is contested, where processing is unlawful but deletion is not requested, or where the user requires the data for legal claims.</p>
            </SubSection>

            <SubSection number="8.5" title="Right to Data Portability">
              <p>Users may request a copy of their personal data in a structured, commonly used, and machine-readable format where applicable.</p>
              <p>Such requests may be submitted through MaidHive\u2019s support channels. MaidHive may provide the requested information within a reasonable timeframe in accordance with applicable data protection laws.</p>
            </SubSection>

            <SubSection number="8.6" title="Right to Object">
              <p>Users may object to certain processing of their personal data, particularly where such processing is based on legitimate interests.</p>
              <p>Users may also withdraw consent for optional communications such as marketing emails at any time by using the unsubscribe option included in such communications or by adjusting their account preferences.</p>
            </SubSection>

            <SubSection number="8.7" title="Right to Lodge a Complaint">
              <p>Users who believe that their personal data has been processed in violation of applicable data protection laws have the right to lodge a complaint with the relevant supervisory authority.</p>
              <p>For users located in Cyprus, this authority is the:</p>
              <p className="font-semibold text-gray-800">Office of the Commissioner for Personal Data Protection.</p>
              <p>Users may also contact MaidHive directly to seek resolution of any concerns regarding the handling of personal data.</p>
            </SubSection>

            <SubSection number="8.8" title="Automated Decision-Making">
              <p>MaidHive does not carry out automated decision-making or profiling that produces legal or similarly significant effects on users.</p>
            </SubSection>
          </Section>

          {/* ─── Section 9 ─── */}
          <Section number="9" title="Children\u2019s Privacy">
            <p>The MaidHive Platform is intended for use by individuals who are at least 18 years of age.</p>
            <p>Users must be at least 18 years old to create an account, request services, or offer services through the Platform.</p>
            <p>MaidHive does not knowingly collect or process personal data from individuals under the age of 18.</p>
            <p>If MaidHive becomes aware that personal data has been collected from a person under the age of 18 without appropriate legal authority, MaidHive may take steps to remove the account and delete the associated data.</p>
            <p>Parents or guardians who believe that a minor has provided personal data to MaidHive may contact the Platform using the contact information provided in this Privacy Policy.</p>
          </Section>

          {/* ─── Section 10 ─── */}
          <Section number="10" title="Third-Party Services">
            <p>MaidHive may use third-party service providers to support the operation of the Platform. These providers perform services on behalf of MaidHive and may process personal data where necessary to provide those services.</p>
            <p>Such service providers are required to process personal data in accordance with applicable data protection laws and appropriate contractual safeguards.</p>
            <p>The categories of third-party services used by MaidHive may include the following.</p>

            <SubSection number="10.1" title="Payment Processing">
              <p>MaidHive uses third-party payment processors, including Stripe, to facilitate payments made through the Platform.</p>
              <p>These payment processors may process payment information, billing details, and transaction data in order to authorise payments, capture charges, process refunds, and facilitate payouts to service providers.</p>
              <p>Such providers process payment data in accordance with their own privacy policies and security standards.</p>
            </SubSection>

            <SubSection number="10.2" title="Cloud Hosting and Infrastructure">
              <p>MaidHive uses third-party cloud infrastructure providers to host the Platform and its associated systems.</p>
              <p>These providers may process data necessary to operate the Platform, including account information, booking records, and system data.</p>
              <p>Cloud infrastructure services may include secure server hosting, database management, and application infrastructure.</p>
            </SubSection>

            <SubSection number="10.3" title="Secure File Storage">
              <p>Files uploaded to the Platform, including profile images, dispute evidence, and identity verification documents submitted by Cleaners, may be stored using secure cloud storage services.</p>
              <p>Such storage systems are configured to restrict public access and allow access only to authorised platform systems and administrative personnel.</p>
            </SubSection>

            <SubSection number="10.4" title="Analytics and Performance Monitoring">
              <p>MaidHive may use analytics and performance monitoring tools to understand how the Platform is used and to improve the Service.</p>
              <p>These tools may collect information about user interactions with the Platform, such as page visits, feature usage, and technical performance metrics.</p>
              <p>Where applicable, analytics tools may operate with privacy safeguards such as anonymised or aggregated data collection.</p>
            </SubSection>

            <SubSection number="10.5" title="Email and Communication Services">
              <p>MaidHive may use third-party email delivery services to send operational communications to users.</p>
              <p>These communications may include account verification emails, booking confirmations, password reset messages, and service notifications.</p>
              <p>Such services process email addresses and related communication data solely for the purpose of delivering these messages on behalf of MaidHive.</p>
            </SubSection>

            <SubSection number="10.6" title="Customer Support Tools">
              <p>MaidHive may use third-party customer support tools to manage user inquiries, support requests, and dispute communications.</p>
              <p>These tools may process limited user information necessary to provide support services and resolve platform issues.</p>
            </SubSection>
          </Section>

          {/* ─── Section 11 ─── */}
          <Section number="11" title="International Data Transfers">
            <p>MaidHive operates primarily within the European Economic Area (EEA). However, in order to provide the Platform and related services, MaidHive may use third-party service providers that process data in jurisdictions outside the EEA.</p>
            <p>Such providers may include payment processors, cloud infrastructure providers, analytics services, communication services, and other technical service providers necessary for the operation of the Platform.</p>
            <p>Where personal data is transferred to or processed in countries outside the EEA, MaidHive takes appropriate steps to ensure that such transfers comply with applicable data protection laws. These safeguards may include the use of legally approved transfer mechanisms such as Standard Contractual Clauses (SCCs) or other recognised data protection safeguards.</p>
            <p>Personal data may be transferred to and processed in countries outside a user\u2019s country of residence where necessary to operate the Service and provide the functionality of the Platform, including where such transfers are necessary for the performance of a contract or based on appropriate safeguards.</p>
            <p>MaidHive takes reasonable measures to ensure that personal data transferred internationally remains protected in accordance with applicable data protection standards.</p>
          </Section>

          {/* ─── Section 12 ─── */}
          <Section number="12" title="Changes to this Privacy Policy">
            <p>MaidHive may update or modify this Privacy Policy from time to time in order to reflect changes in the Platform, applicable laws, regulatory requirements, or data processing practices.</p>
            <p>When updates are made, the revised version of the Privacy Policy will be published on the Platform and the &ldquo;Last Updated&rdquo; date at the top of the document will be updated accordingly.</p>
            <p>Where material changes are made to this Privacy Policy, MaidHive may provide additional notice to users through appropriate means, which may include email notifications or notices displayed within the Platform.</p>
            <p>Users are encouraged to review this Privacy Policy periodically to remain informed about how their personal information is collected, used, and protected.</p>
            <p>Continued use of the Platform after updates become effective constitutes acknowledgement of the updated Privacy Policy.</p>
          </Section>

          {/* ─── Section 13 ─── */}
          <Section number="13" title="Contact Information">
            <p>If you have questions about this Privacy Policy or wish to exercise your data protection rights, you may contact MaidHive using the following contact details.</p>
            <div className="bg-gray-50 rounded-xl p-6 mt-4">
              <p className="font-semibold text-gray-900 mb-1">MaidHive Ltd.</p>
              <p>Cyprus</p>
              <p>Email: <a href="mailto:support@maidhive.app" className="text-primary hover:underline">support@maidhive.app</a></p>
              <p className="mt-2">MaidHive will respond to privacy-related enquiries and requests in accordance with applicable data protection laws.</p>
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
