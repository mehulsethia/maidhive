import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms & Conditions — MaidHive',
  description: 'Read the Terms and Conditions for using MaidHive.',
}

export default function TermsPage() {
  return (
    <>
      {/* Gradient header */}
      <div
        className="px-6 py-16 text-white text-center"
        style={{
          background: 'radial-gradient(ellipse at 30% 50%, #0088DD 19%, #044EE2 38%, #030016 100%)',
        }}
      >
        <h1 className="text-4xl font-bold mb-3">Terms &amp; Conditions</h1>
        <p className="text-white/70 text-sm">Last updated: April 2025</p>
      </div>

      {/* Content */}
      <div className="bg-white px-6 py-16">
        <div className="max-w-3xl mx-auto prose prose-gray prose-headings:font-bold prose-headings:text-gray-900 prose-p:text-gray-600 prose-li:text-gray-600 prose-a:text-[#044EE2]">

          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing or using the MaidHive platform (&quot;Service&quot;), you agree to be bound by these Terms and Conditions (&quot;Terms&quot;). If you do not agree, you may not access or use the Service.
          </p>

          <h2>2. Description of Service</h2>
          <p>
            MaidHive is an online marketplace that connects clients seeking cleaning services (&quot;Clients&quot;) with independent professional cleaners (&quot;Cleaners&quot;). MaidHive acts solely as an intermediary and is not responsible for the actions, conduct, or performance of any Cleaner or Client.
          </p>

          <h2>3. User Accounts</h2>
          <p>
            You must register for an account to use most features of the Service. You agree to provide accurate, current, and complete information and to keep your account credentials secure. You are responsible for all activity that occurs under your account.
          </p>

          <h2>4. Bookings and Payments</h2>
          <p>
            Clients pay upfront at the time of booking. Funds are held securely and released to the Cleaner only after the job is completed. MaidHive charges a platform fee on each transaction. All prices are inclusive of this fee unless otherwise stated.
          </p>

          <h2>5. Cancellations and Refunds</h2>
          <p>
            Cancellation policies vary depending on the notice period provided. Clients who cancel within the permitted window may be eligible for a full or partial refund. Late cancellations or no-shows may result in a charge. Cleaners who cancel or no-show may receive a strike against their account.
          </p>

          <h2>6. Cleaner Vetting</h2>
          <p>
            MaidHive conducts reasonable vetting of Cleaners prior to approval. However, MaidHive does not guarantee the quality, safety, or legality of services provided. Clients use the Service at their own risk.
          </p>

          <h2>7. Prohibited Conduct</h2>
          <p>You agree not to:</p>
          <ul>
            <li>Use the Service for any unlawful purpose</li>
            <li>Circumvent the platform to arrange off-platform payments</li>
            <li>Post false, misleading, or fraudulent reviews</li>
            <li>Harass, abuse, or discriminate against any user</li>
            <li>Attempt to gain unauthorised access to any part of the Service</li>
          </ul>

          <h2>8. Intellectual Property</h2>
          <p>
            All content, trademarks, and materials on the MaidHive platform are the property of MaidHive or its licensors. You may not reproduce, distribute, or create derivative works without prior written consent.
          </p>

          <h2>9. Limitation of Liability</h2>
          <p>
            To the fullest extent permitted by law, MaidHive shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising out of your use of the Service, even if MaidHive has been advised of the possibility of such damages.
          </p>

          <h2>10. Governing Law</h2>
          <p>
            These Terms shall be governed by and construed in accordance with the laws of Ireland. Any disputes shall be subject to the exclusive jurisdiction of the courts of Ireland.
          </p>

          <h2>11. Changes to Terms</h2>
          <p>
            MaidHive reserves the right to modify these Terms at any time. We will notify you of material changes by posting the updated Terms on this page. Continued use of the Service after changes constitutes acceptance.
          </p>

          <h2>12. Contact</h2>
          <p>
            For questions about these Terms, contact us at <a href="mailto:legal@maidhive.app">legal@maidhive.app</a>.
          </p>
        </div>
      </div>
    </>
  )
}
