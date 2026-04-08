import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy — MaidHive',
  description: 'Learn how MaidHive collects, uses, and protects your personal data.',
}

export default function PrivacyPage() {
  return (
    <>
      {/* Gradient header */}
      <div
        className="px-6 py-16 text-white text-center"
        style={{
          background: 'radial-gradient(ellipse at 30% 50%, #0088DD 19%, #044EE2 38%, #030016 100%)',
        }}
      >
        <h1 className="text-4xl font-bold mb-3">Privacy Policy</h1>
        <p className="text-white/70 text-sm">Last updated: April 2025</p>
      </div>

      {/* Content */}
      <div className="bg-white px-6 py-16">
        <div className="max-w-3xl mx-auto prose prose-gray prose-headings:font-bold prose-headings:text-gray-900 prose-p:text-gray-600 prose-li:text-gray-600 prose-a:text-[#044EE2]">

          <h2>1. Introduction</h2>
          <p>
            MaidHive (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) is committed to protecting your personal data. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform.
          </p>

          <h2>2. Data We Collect</h2>
          <p>We collect the following categories of personal data:</p>
          <ul>
            <li><strong>Account data:</strong> name, email address, password (hashed), and role (Client or Cleaner)</li>
            <li><strong>Profile data:</strong> profile photo, bio, service areas, hourly rate (Cleaners)</li>
            <li><strong>Booking data:</strong> address, scheduled date and time, service type, duration</li>
            <li><strong>Payment data:</strong> payment method details processed securely via Stripe; we do not store card numbers</li>
            <li><strong>Communications:</strong> messages exchanged through the platform</li>
            <li><strong>Usage data:</strong> IP address, browser type, pages visited, timestamps</li>
          </ul>

          <h2>3. How We Use Your Data</h2>
          <p>We use your personal data to:</p>
          <ul>
            <li>Provide, operate, and improve the MaidHive platform</li>
            <li>Process bookings and payments</li>
            <li>Send booking confirmations, reminders, and service notifications</li>
            <li>Detect and prevent fraud, abuse, and security incidents</li>
            <li>Comply with legal obligations</li>
            <li>Respond to your support requests</li>
          </ul>

          <h2>4. Legal Basis for Processing (GDPR)</h2>
          <p>We process your data on the following legal bases:</p>
          <ul>
            <li><strong>Contract:</strong> processing necessary to provide the Service you have requested</li>
            <li><strong>Legitimate interests:</strong> fraud prevention, platform security, and service improvement</li>
            <li><strong>Legal obligation:</strong> compliance with applicable laws</li>
            <li><strong>Consent:</strong> where you have provided explicit consent (e.g., marketing communications)</li>
          </ul>

          <h2>5. Data Sharing</h2>
          <p>We share your data only in the following circumstances:</p>
          <ul>
            <li><strong>Between users:</strong> Clients and Cleaners see each other's names and relevant booking details</li>
            <li><strong>Service providers:</strong> Stripe (payments), Supabase (database), Vercel (hosting) — all bound by data processing agreements</li>
            <li><strong>Legal requirements:</strong> when required by law or to protect the rights of MaidHive or others</li>
          </ul>
          <p>We do not sell your personal data to third parties.</p>

          <h2>6. Data Retention</h2>
          <p>
            We retain your personal data for as long as your account is active or as needed to provide the Service. You may request deletion of your account and associated data at any time by contacting us.
          </p>

          <h2>7. Your Rights</h2>
          <p>Under applicable data protection law, you have the right to:</p>
          <ul>
            <li>Access the personal data we hold about you</li>
            <li>Rectify inaccurate or incomplete data</li>
            <li>Request deletion of your data (&quot;right to be forgotten&quot;)</li>
            <li>Restrict or object to processing</li>
            <li>Data portability</li>
            <li>Withdraw consent at any time</li>
          </ul>
          <p>To exercise any of these rights, contact us at <a href="mailto:privacy@maidhive.app">privacy@maidhive.app</a>.</p>

          <h2>8. Cookies</h2>
          <p>
            We use essential cookies to maintain your session and authentication state. We do not use third-party tracking or advertising cookies.
          </p>

          <h2>9. Security</h2>
          <p>
            We implement industry-standard security measures including HTTPS encryption, hashed passwords, and role-based access controls. However, no system is completely secure and we cannot guarantee absolute security.
          </p>

          <h2>10. International Transfers</h2>
          <p>
            Your data may be processed in countries outside the EEA by our service providers. Where this occurs, we ensure appropriate safeguards are in place (e.g., Standard Contractual Clauses).
          </p>

          <h2>11. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify you of significant changes by email or via the platform. Continued use of the Service constitutes acceptance of the updated policy.
          </p>

          <h2>12. Contact</h2>
          <p>
            For privacy-related enquiries, contact our Data Controller at <a href="mailto:privacy@maidhive.app">privacy@maidhive.app</a>.
          </p>
        </div>
      </div>
    </>
  )
}
